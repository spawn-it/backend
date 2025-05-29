const OpenTofuCommand = require('../utils/opentofu');
const OpenTofuStatus = require('../utils/OpenTofuStatus');
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

  const status = await networkRunner.runPlan();
  if (!status.isCompliant()) {
    throw new Error(`Network for client ${clientId} provider ${provider} is not ready: ${status.state}`);
  }

  console.log(`[TOFU] Network for client ${clientId} provider ${provider} is ready.`);
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
        const instanceRaw = await s3Service.getFile(process.env.S3_BUCKET, `clients/${clientId}/${serviceId}/terraform.tfvars.json`);
        const instanceJson = JSON.parse(instanceRaw);
        const instanceConfig = new InstanceConfig(instanceJson.instance || instanceJson);
        await checkNetworkIsReady(clientId, instanceConfig, process.env.S3_BUCKET);
      }

      const status = await runner.runPlan();
      sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()));
    } catch (err) {
      const errorStatus = OpenTofuStatus.fromError(key, '', err);
      sendToClients(clientId, serviceId, JSON.stringify(errorStatus.toJSON()));
    }
  }, intervalMs));

  console.log(`[TOFU] plan loop started for ${key}`);
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
  
  // Déterminer si c'est une action réseau
  const isNetworkAction = serviceId.startsWith('network/');
  
  let instanceConfig = null;
  
  // Seulement lire la config d'instance si ce n'est pas une action réseau
  if (!isNetworkAction) {
    try {
      const instanceRaw = await s3Service.getFile(bucket, `clients/${clientId}/${serviceId}/terraform.tfvars.json`);
      const instanceJson = JSON.parse(instanceRaw);
      instanceConfig = new InstanceConfig(instanceJson.instance || instanceJson);
    } catch (err) {
      console.error(`[TOFU] Error reading instance config for ${clientId}/${serviceId}:`, err);
      if (!res.headersSent) {
        return res.status(500).json({ error: `Configuration manquante pour ${serviceId}` });
      }
      return;
    }
  }

  stopPlanLoop(clientId, serviceId);
  const runner = getCommandInstance(clientId, serviceId, dataDir, codeDir);

  try {
    const jobId = uuidv4();

    // Vérifier que le réseau est prêt seulement pour les services (pas pour les actions réseau)
    if (!isNetworkAction && instanceConfig) {
      await checkNetworkIsReady(clientId, instanceConfig, bucket);
    }

    res.json({ jobId });

    const proc = await runner.spawnCommand(action);
    jobs.set(jobId, proc);

    let output = '';

    proc.stdout.on('data', chunk => {
      const text = chunk.toString();
      output += text;
      sendToClients(clientId, serviceId, text, 'data');
    });

    proc.stderr.on('data', chunk => {
      const text = chunk.toString();
      output += text;
      sendToClients(clientId, serviceId, text, 'error');
    });

    proc.on('close', code => {
      jobs.delete(jobId);
      const status = code === 0
        ? new OpenTofuStatus(`${clientId}/${serviceId}`, 'success', output)
        : OpenTofuStatus.fromError(`${clientId}/${serviceId}`, output, new Error(`${action} exited with code ${code}`));

      sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()), 'end');

      if (action === 'apply') startPlanLoop(clientId, serviceId, dataDir);
    });

    proc.on('error', err => {
      jobs.delete(jobId);
      const status = OpenTofuStatus.fromError(`${clientId}/${serviceId}`, output, err);
      sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()), 'error');

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

/**
 * Vérifie le statut du réseau avec gestion d'erreur améliorée
 */
async function checkNetworkStatus(clientId, bucket, key) {
  try {
    // Vérifier que le fichier existe d'abord
    await s3Service.getFile(bucket, key);
  } catch (err) {
    if (err.code === 'NoSuchKey') {
      // Retourner un statut "non compliant" au lieu de lever une erreur
      return {
        isCompliant: () => false,
        toJSON: () => ({ compliant: false, state: 'missing_config', message: 'Configuration réseau manquante' })
      };
    }
    throw err;
  }

  // Extraire le provider du chemin
  const pathParts = key.split('/');
  const provider = pathParts[pathParts.length - 2]; // network/[provider]/terraform.tfvars.json
  
  const dataDir = await prepareWorkingDirectory(clientId, `network/${provider}`, bucket);
  const runner = getCommandInstance(clientId, `network/${provider}`, dataDir, NETWORK_CODE_DIR);
  
  try {
    await runner.ensureInitialized();
    return await runner.runPlan();
  } catch (err) {
    console.error(`[TOFU] Error running plan for network ${clientId}/${provider}:`, err);
    return {
      isCompliant: () => false,
      toJSON: () => ({ compliant: false, state: 'error', message: err.message })
    };
  }
}

module.exports = {
  OPENTOFU_CODE_DIR,
  NETWORK_CODE_DIR,
  startPlanLoop,
  stopPlanLoop,
  cancelJob,
  executeAction,
  executePlan,
  checkNetworkStatus
};
