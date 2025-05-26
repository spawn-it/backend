const OpenTofuCommand = require('../utils/opentofu');
const { v4: uuidv4 } = require('uuid');
const { sendToClients } = require('../sse/clients');
const path = require('path');
const fs = require('fs').promises;
const s3Service = require('./s3');

const jobs = new Map();
const planLoops = new Map();
const instances = new Map();

// Base working directory pour les données client/service
const BASE_WORKING_DIR = process.env.TOFU_WORKING_DIR || '/workdirs/';
// Répertoire où se trouve le code OpenTofu partagé
const OPENTOFU_CODE_DIR = process.env.OPENTOFU_CODE_DIR || './opentofu/services';

/**
 * Prepare working directory for a client/service by downloading files from S3
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} bucket
 * @returns {Promise<string>} path to the working directory
 */
async function prepareWorkingDirectory(clientId, serviceId, bucket) {
  // Créer le répertoire de données pour ce client/service
  const dataDir = path.join(BASE_WORKING_DIR, clientId, serviceId);
  const s3Prefix = `clients/${clientId}/${serviceId}/`;

  // Create directory if it doesn't exist
  await fs.mkdir(dataDir, { recursive: true });

  // Download files from S3 dans le répertoire de données
  await s3Service.downloadFiles(bucket, s3Prefix, dataDir);

  return dataDir;
}

/**
 * Get or create a OpenTofuCommand instance for a client/service
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} dataDir - répertoire contenant les données client/service
 * @param {string} [codeDir=OPENTOFU_CODE_DIR] - répertoire contenant le code OpenTofu
 * @returns {OpenTofuCommand}
 */
function getCommandInstance(clientId, serviceId, dataDir, codeDir = OPENTOFU_CODE_DIR) {
  const key = `${clientId}/${serviceId}`;
  if (!instances.has(key)) {
    instances.set(key, new OpenTofuCommand(clientId, serviceId, codeDir, dataDir));
  }
  return instances.get(key);
}

/**
 * Starts a continuous 'tofu plan' loop for a given client/service.
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} dataDir - répertoire contenant les données client/service
 * @param {number} intervalMs
 */
function startPlanLoop(clientId, serviceId, dataDir, intervalMs = 10000) {
  const key = `${clientId}/${serviceId}`;
  if (planLoops.has(key)) {
    stopPlanLoop(clientId, serviceId);
  }

  const runner = getCommandInstance(clientId, serviceId, dataDir);

  planLoops.set(key, setInterval(async () => {
    console.log(`[TOFU] Boucle plan tick pour ${key}`);
    try {
      const output = await runner.runPlan();
      console.log(`[DEBUG] runPlan output length: ${output.length}`);
      console.log(`[TOFU PLAN] ${clientId}/${serviceId}:\n${output}`);

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
 * Stops the continuous 'tofu plan' loop.
 * @param {string} clientId
 * @param {string} serviceId
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
 * Cancels a running Terraform job by jobId.
 * @param {string} jobId
 */
function cancelJob(jobId) {
  const proc = jobs.get(jobId);
  if (!proc) return;
  proc.kill('SIGTERM');
  jobs.delete(jobId);
  console.log(`[TOFU] job cancelled ${jobId}`);
}

/**
 * Start the plan loop for a specific client/service
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} bucket
 */
async function executePlan(clientId, serviceId, bucket) {
  const dataDir = await prepareWorkingDirectory(clientId, serviceId, bucket);
  startPlanLoop(clientId, serviceId, dataDir);
  return { status: 'started', codeDir: OPENTOFU_CODE_DIR, dataDir };
}

/**
 * Executes a Terraform action (apply, destroy) or single-run plan and streams via SSE.
 * @param {string} action - 'plan'|'apply'|'destroy'
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} bucket
 * @param {object} res - Express response object to return jobId
 * @param {string} [codeDir=OPENTOFU_CODE_DIR] - Directory containing OpenTofu code
 */
async function executeAction(action, clientId, serviceId, bucket, res, codeDir = OPENTOFU_CODE_DIR) {
  const dataDir = await prepareWorkingDirectory(clientId, serviceId, bucket);

  // Always stop any existing plan loop before running an action
  stopPlanLoop(clientId, serviceId);

  const runner = getCommandInstance(clientId, serviceId, dataDir, codeDir);
  try {
    const jobId = uuidv4();
    // Spawn command - le code est dans OPENTOFU_CODE_DIR, les données dans dataDir
    const proc = await runner.spawnCommand(action);
    jobs.set(jobId, proc);
    res.json({ jobId });

    let output = '';
    proc.stdout.on('data', (chunk) => {
      const data = chunk.toString();
      output += data;
      sendToClients(clientId, serviceId, data, 'data');
    });

    proc.stderr.on('data', (chunk) => {
      const data = chunk.toString();
      output += data;
      sendToClients(clientId, serviceId, data, 'error');
    });

    proc.on('close', (code) => {
      jobs.delete(jobId);
      sendToClients(clientId, serviceId, `${action} completed with code ${code}`, 'end');

      if (action === 'apply') {
        // restart plan loop after apply
        startPlanLoop(clientId, serviceId, dataDir);
      }
    });
  } catch (err) {
    console.error(`Error executing ${action} for ${clientId}/${serviceId}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = {
  OPENTOFU_CODE_DIR,
  startPlanLoop,
  stopPlanLoop,
  cancelJob,
  executeAction,
  executePlan,
};