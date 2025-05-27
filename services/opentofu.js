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

/**
 * Prépare le répertoire de travail local en téléchargeant les fichiers depuis S3
 * @param {string} clientId
 * @param {string} serviceId (peut être 'network/local', etc.)
 * @param {string} bucket
 * @returns {Promise<string>} chemin du répertoire local
 */
async function prepareWorkingDirectory(clientId, serviceId, bucket) {
  const safeServiceId = serviceId.replace(/\//g, path.sep);
  const dataDir = path.join(BASE_WORKING_DIR, clientId, safeServiceId);
  const s3Prefix = `clients/${clientId}/${serviceId}/`;
  await fs.mkdir(dataDir, { recursive: true });
  await s3Service.downloadFiles(bucket, s3Prefix, dataDir);
  console.log(`[TOFU] Répertoire de travail préparé pour ${clientId}/${serviceId} : ${dataDir}`);
  return dataDir;
}

/**
 * Obtient ou crée une instance OpenTofuCommand
 */
function getCommandInstance(clientId, serviceId, dataDir, codeDir) {
  const key = `${clientId}/${serviceId}`;
  if (!instances.has(key)) {
    instances.set(key, new OpenTofuCommand(clientId, serviceId, codeDir, dataDir));
  }
  return instances.get(key);
}

/**
 * Vérifie que le réseau spécifique au provider est prêt (pas de changement planifié)
 * @param {string} clientId
 * @param {InstanceConfig} instanceConfig
 * @param {string} bucket
 */
async function checkNetworkIsReady(clientId, instanceConfig, bucket) {
  if (!instanceConfig.provider || !instanceConfig.network_name) {
    throw new Error(`InstanceConfig missing provider or network_name`);
  }

  const provider = instanceConfig.provider;
  const key = `clients/${clientId}/network/${provider}/terraform.tfvars.json`;

  // Vérifier que la config réseau existe
  let networkVarsRaw;
  try {
    networkVarsRaw = await s3Service.getFile(bucket, key);
  } catch (err) {
    throw new Error(`Network configuration missing for client ${clientId} and provider ${provider}`);
  }

  // Préparer répertoire réseau
  const networkDataDir = await prepareWorkingDirectory(clientId, `network/${provider}`, bucket);
  const networkRunner = getCommandInstance(clientId, `network/${provider}`, networkDataDir, NETWORK_CODE_DIR);

  // Initialiser (si besoin)
  await networkRunner.ensureInitialized();

  // Lancer plan sans couleur
  const planOutput = await networkRunner.runPlan();

  // Vérifier qu’il n’y a pas de changements planifiés
  const cleanPlanRegex = /Plan:\s+0 to add,\s+0 to change,\s+0 to destroy/;
  if (!cleanPlanRegex.test(planOutput)) {
    throw new Error(`Network for client ${clientId} provider ${provider} is not ready: pending changes detected.`);
  }

  console.log(`[TOFU] Network for client ${clientId} provider ${provider} is ready (no pending changes).`);
}

/**
 * Démarre la boucle plan continue
 */
async function startPlanLoop(clientId, serviceId, dataDir, intervalMs = 10000) {
  const key = `${clientId}/${serviceId}`;
  if (planLoops.has(key)) stopPlanLoop(clientId, serviceId);

  const runner = getCommandInstance(clientId, serviceId, dataDir, OPENTOFU_CODE_DIR);

  planLoops.set(key, setInterval(async () => {
    console.log(`[TOFU] Boucle plan tick pour ${key}`);

    try {
      if (serviceId !== 'network') {
        // Charger config instance pour récupérer provider et network_name
        const instanceRaw = await s3Service.getFile(process.env.S3_BUCKET, `clients/${clientId}/${serviceId}/terraform.tfvars.json`);
        const instanceJson = JSON.parse(instanceRaw);
        const instanceConfig = new InstanceConfig(instanceJson.instance || instanceJson);

        await checkNetworkIsReady(clientId, instanceConfig, process.env.S3_BUCKET);
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

/**
 * Arrête la boucle plan
 */
function stopPlanLoop(clientId, serviceId) {
  const key = `${clientId}/${serviceId}`;
  const intervalId = planLoops.get(key);
  if (!intervalId) return;
  clearInterval(intervalId);
  planLoops.delete(key);
  console.log(`[TOFU] plan loop stopped for ${key}`);
}

/**
 * Annule un job terraform
 */
function cancelJob(jobId) {
  const proc = jobs.get(jobId);
  if (!proc) return;
  proc.kill('SIGTERM');
  jobs.delete(jobId);
  console.log(`[TOFU] job cancelled ${jobId}`);
}

/**
 * Exécute une action terraform (plan, apply, destroy)
 * Vérifie la préparation du réseau avant d'exécuter l'action sur un service autre que réseau
 */
async function executeAction(action, clientId, serviceId, bucket, res, codeDir = OPENTOFU_CODE_DIR) {
  const dataDir = await prepareWorkingDirectory(clientId, serviceId, bucket);
  const instanceRaw = await s3Service.getFile(bucket, `clients/${clientId}/${serviceId}/terraform.tfvars.json`);
  const instanceJson = JSON.parse(instanceRaw);
  const instanceConfig = new InstanceConfig(instanceJson.instance || instanceJson);

  stopPlanLoop(clientId, serviceId);
  const runner = getCommandInstance(clientId, serviceId, dataDir, codeDir);

  try {
    const jobId = uuidv4();

    if (serviceId !== 'network') {
      await checkNetworkIsReady(clientId, instanceConfig, bucket);
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

/**
 * Lance la boucle plan
 */
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
