const OpenTofuCommand = require('../utils/opentofu');
const { v4: uuidv4 } = require('uuid');
const { sendToClients } = require('../sse/clients');
const path = require('path');
const fs = require('fs').promises;
const s3Service = require('./s3');
const NetworkConfig = require('../models/NetworkConfig');
const InstanceConfig = require('../models/InstanceConfig');

const jobs = new Map();
const planLoops = new Map();
const instances = new Map();

const BASE_WORKING_DIR = path.resolve(process.env.TOFU_WORKING_DIR || './workdirs');
const OPENTOFU_CODE_DIR = path.resolve(process.env.OPENTOFU_CODE_DIR || './opentofu/services');
const NETWORK_CODE_DIR = path.resolve(process.env.NETWORK_CODE_DIR || './opentofu/networks');

async function prepareWorkingDirectory(clientId, serviceId, bucket) {
  const dataDir = path.join(BASE_WORKING_DIR, clientId, serviceId);
  const s3Prefix = `clients/${clientId}/${serviceId}/`;
  await fs.mkdir(dataDir, { recursive: true });
  await s3Service.downloadFiles(bucket, s3Prefix, dataDir);
  console.log(`[TOFU] Répertoire de travail préparé pour ${clientId}/${serviceId} : ${dataDir}`);
  return dataDir;
}

function getCommandInstance(clientId, serviceId, dataDir, codeDir) {
  const key = `${clientId}/${serviceId}`;
  if (!instances.has(key)) {
    instances.set(key, new OpenTofuCommand(clientId, serviceId, codeDir, dataDir));
  }
  return instances.get(key);
}

async function ensureNetworkConfigExists(clientId, bucket) {
  const key = `clients/${clientId}/network/terraform.tfvars.json`;

  try {
    await s3Service.getFile(bucket, key);
    console.log(`[TOFU] Network config exists for client ${clientId}`);

  } catch (err) {
    if (err.code === 'NoSuchKey' || err.message.includes('NotFound')) {
      console.log(`[TOFU] Network config missing for client ${clientId}, creating...`);

      // Charge config instance principale
      const serviceKey = `clients/${clientId}/wordpress/terraform.tfvars.json`;
      let instanceRaw;
      try {
        instanceRaw = await s3Service.getFile(bucket, serviceKey);
      } catch (err2) {
        console.error(`[TOFU] Impossible de charger l'instance config du service principal pour ${clientId}:`, err2);
        throw err2;
      }

      const instanceJson = JSON.parse(instanceRaw);
      const instanceConfig = new InstanceConfig(instanceJson.instance || instanceJson);

      const networkConfig = new NetworkConfig({
        provider: instanceConfig.provider,
        network_name: instanceConfig.network_name
      });

      const jsonContent = JSON.stringify({ instance: networkConfig.toJSON() }, null, 2);

      await s3Service.createFile(bucket, key, jsonContent);
      console.log(`[TOFU] Network config created for client ${clientId} at ${key}`);

      await new Promise(r => setTimeout(r, 500));
    } else {
      throw err;
    }
  }
}

/**
 * Applique le réseau en attendant la fin et streamant les logs
 */
async function applyNetwork(clientId, bucket) {
  await ensureNetworkConfigExists(clientId, bucket);

  const networkDataDir = await prepareWorkingDirectory(clientId, 'network', bucket);
  const networkRunner = getCommandInstance(clientId, 'network', networkDataDir, NETWORK_CODE_DIR);

  stopPlanLoop(clientId, 'network');

  console.log(`[TOFU] Applying network for client ${clientId}`);
  const networkProc = await networkRunner.spawnCommand('apply');

  await new Promise((resolve, reject) => {
    let output = '';

    networkProc.stdout.on('data', chunk => {
      const str = chunk.toString();
      output += str;
      sendToClients(clientId, 'network', str, 'data');
    });
    networkProc.stderr.on('data', chunk => {
      const str = chunk.toString();
      output += str;
      sendToClients(clientId, 'network', str, 'error');
    });

    networkProc.on('close', code => {
      sendToClients(clientId, 'network', `apply completed with code ${code}`, 'end');
      if (code !== 0) {
        console.error(`[TOFU] Network apply failed for ${clientId} with output:\n${output}`);
        reject(new Error(`Network apply failed with code ${code}`));
      }
      else resolve();
    });

    networkProc.on('error', err => {
      console.error(`[TOFU] Network apply process error for ${clientId}:`, err);
      reject(err);
    });
  });
}


async function startPlanLoop(clientId, serviceId, dataDir, intervalMs = 10000) {
  const key = `${clientId}/${serviceId}`;
  if (planLoops.has(key)) stopPlanLoop(clientId, serviceId);

  const runner = getCommandInstance(clientId, serviceId, dataDir, OPENTOFU_CODE_DIR);

  planLoops.set(key, setInterval(async () => {
    console.log(`[TOFU] Boucle plan tick pour ${key}`);

    try {
      if (serviceId !== 'network') {
        await applyNetwork(clientId, process.env.S3_BUCKET);
      }

      const output = await runner.runPlan();
      console.log(`[TOFU PLAN] ${clientId}/${serviceId}:\n${output}`);
      sendToClients(clientId, serviceId, output);

    } catch (err) {
      console.error(`[TOFU] Erreur dans la boucle plan pour ${key}:`, err.message);
      sendToClients(clientId, serviceId, `Error during plan: ${err.message}`);
    }
  }, intervalMs));

  console.log(`[TOFU] plan loop started for ${key} (code: ${OPENTOFU_CODE_DIR}, data: ${dataDir})`);
}

function stopPlanLoop(clientId, serviceId) {
  const key = `${clientId}/${serviceId}`;
  const intervalId = planLoops.get(key);
  if (!intervalId) return;
  clearInterval(intervalId);
  planLoops.delete(key);
  console.log(`[TOFU] plan loop stopped for ${key}`);
}

function cancelJob(jobId) {
  const proc = jobs.get(jobId);
  if (!proc) return;
  proc.kill('SIGTERM');
  jobs.delete(jobId);
  console.log(`[TOFU] job cancelled ${jobId}`);
}

async function executeAction(action, clientId, serviceId, bucket, res, codeDir = OPENTOFU_CODE_DIR) {
  const dataDir = await prepareWorkingDirectory(clientId, serviceId, bucket);
  const instanceJson = await s3Service.getFile(bucket, `clients/${clientId}/${serviceId}/terraform.tfvars.json`);
  const instanceConfig = new InstanceConfig(instanceJson);
  console.log(`[TOFU] Instance config for ${clientId}/${serviceId}:`, instanceConfig);

  stopPlanLoop(clientId, serviceId);
  const runner = getCommandInstance(clientId, serviceId, dataDir, codeDir);

  try {
    const jobId = uuidv4();

    if (action === 'apply' && serviceId !== 'network') {
      await applyNetwork(clientId, bucket);
    }

    res.json({ jobId });

    const proc = await runner.spawnCommand(action);
    jobs.set(jobId, proc);

    proc.stdout.on('data', chunk => sendToClients(clientId, serviceId, chunk.toString(), 'data'));
    proc.stderr.on('data', chunk => sendToClients(clientId, serviceId, chunk.toString(), 'error'));

    proc.on('close', code => {
      jobs.delete(jobId);
      sendToClients(clientId, serviceId, `${action} completed with code ${code}`, 'end');
      if (action === 'apply') startPlanLoop(clientId, serviceId, dataDir);
    });

    proc.on('error', err => {
      jobs.delete(jobId);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });

  } catch (err) {
    console.error(`[TOFU] Error executing ${action} for ${clientId}/${serviceId}:`, err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}

async function executePlan(clientId, serviceId, bucket) {
  const dataDir = await prepareWorkingDirectory(clientId, serviceId, bucket);
  startPlanLoop(clientId, serviceId, dataDir);
  return { status: 'started', codeDir: OPENTOFU_CODE_DIR, dataDir };
}

module.exports = {
  OPENTOFU_CODE_DIR,
  NETWORK_CODE_DIR,
  startPlanLoop,
  stopPlanLoop,
  cancelJob,
  executeAction,
  executePlan,
};
