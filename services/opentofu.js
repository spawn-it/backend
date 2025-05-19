const OpenTofuCommand = require('../utils/opentofu');
const { v4: uuidv4 } = require('uuid');
const { sendToClients } = require('../sse/clients');
const path = require('path');
const fs = require('fs').promises;
const s3Service = require('./s3');

const jobs = new Map();
const planLoops = new Map();
const instances = new Map(); // Pour garder une instance de OpenTofuCommand par client/service

// Base working directory for all terraform configurations
const BASE_WORKING_DIR = process.env.TOFU_WORKING_DIR || '/opentofu/';

/**
 * Prepare working directory for a client/service by downloading files from S3
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} bucket
 * @returns {Promise<string>} path to the working directory
 */
async function prepareWorkingDirectory(clientId, serviceId, bucket) {
  const workingDir = path.join(BASE_WORKING_DIR, clientId, serviceId);
  const s3Prefix = `clients/${clientId}/${serviceId}/`;
  
  // Create directory if it doesn't exist
  await fs.mkdir(workingDir, { recursive: true });
  
  // Download files from S3
  await s3Service.downloadFiles(bucket, s3Prefix, workingDir);
  
  return workingDir;
}

/**
 * Get or create a OpenTofuCommand instance for a client/service
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} workingDir
 * @returns {OpenTofuCommand}
 */
function getCommandInstance(clientId, serviceId, workingDir) {
  const key = `${clientId}/${serviceId}`;
  if (!instances.has(key)) {
    instances.set(key, new OpenTofuCommand(clientId, serviceId, workingDir));
  }
  return instances.get(key);
}

/**
 * Starts a continuous 'tofu plan' loop for a given client/service.
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} workingDir
 * @param {number} intervalMs
 */
function startPlanLoop(clientId, serviceId, workingDir, intervalMs = 10000) {
  const key = `${clientId}/${serviceId}`;
  if (planLoops.has(key)) {
    stopPlanLoop(clientId, serviceId); // Stop existing loop before starting a new one
  }
  
  const runner = getCommandInstance(clientId, serviceId, workingDir);
  
  planLoops.set(key, setInterval(async () => {
    try {
      const output = await runner.runPlan();
      sendToClients(clientId, serviceId, output);
    } catch (err) {
      sendToClients(clientId, serviceId, `Error during plan: ${err.message}`);
    }
  }, intervalMs));
  
  console.log(`[TOFU] plan loop started for ${key}`);
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
  const workingDir = await prepareWorkingDirectory(clientId, serviceId, bucket);
  startPlanLoop(clientId, serviceId, workingDir);
  return { status: 'started', workingDir };
}

/**
 * Executes a Terraform action (apply, destroy) or single-run plan and streams via SSE.
 * @param {string} action - 'plan'|'apply'|'destroy'
 * @param {string} clientId
 * @param {string} serviceId
 * @param {string} bucket
 * @param {object} res - Express response object to return jobId
 */
async function executeAction(action, clientId, serviceId, bucket, res) {
  const workingDir = await prepareWorkingDirectory(clientId, serviceId, bucket);
  
  // Always stop any existing plan loop before running an action
  stopPlanLoop(clientId, serviceId);
  
  const runner = getCommandInstance(clientId, serviceId, workingDir);
  try {
    const jobId = uuidv4();
    // Utilise spawnCommand qui gère maintenant l'initialisation avec mutex
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
        startPlanLoop(clientId, serviceId, workingDir);
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
  startPlanLoop,
  stopPlanLoop,
  cancelJob,
  executeAction,
  executePlan,
  getCommandInstance,
};