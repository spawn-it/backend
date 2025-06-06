const OpentofuExecutor = require('./executor/OpentofuExecutor');
const NetworkService = require('./NetworkService');
const jobManager = require('./manager/JobManager');
const planLoopManager = require('./manager/PlanLoopManager');
const s3 = require('./s3');
const { OPENTOFU_CODE_DIR, NETWORK_CODE_DIR } = require('../config/paths');

/**
 * TofuService - Service principal qui remplace l'orchestrateur
 * Combine les opérations S3 et Terraform sans les coupler
 */

/**
 * Liste tous les buckets S3 disponibles
 */
async function listBuckets() {
  return s3.listBuckets();
}

/**
 * Liste les clients dans un bucket spécifique
 */
async function listClients(bucket) {
  return s3.listClients(bucket);
}

/**
 * Liste les services d'un client dans un bucket
 */
async function listServices(bucket, clientId) {
  return s3.listServices(bucket, clientId);
}

/**
 * Upload un fichier vers S3 pour un client/service
 */
async function createFile(bucket, key, content) {
  return s3.createFile(bucket, key, content);
}

/**
 * Vérifie si le fichier de configuration réseau existe dans S3
 */
async function checkNetworkConfigExists(bucket, key) {
  return s3.getFile(bucket, key);
}


/**
 * Prépare le répertoire de travail et démarre une boucle de plan Terraform continue
 */
async function executePlan(clientId, serviceId, bucket) {
  return OpentofuExecutor.executePlan(clientId, serviceId, bucket);
}

/**
 * Exécute une action Terraform (plan, apply, destroy) pour un client/service
 */
async function executeAction(action, clientId, serviceId, bucket, res, opentofuCodeDir = OPENTOFU_CODE_DIR) {
  return OpentofuExecutor.executeAction(action, clientId, serviceId, bucket, res, opentofuCodeDir);
}

/**
 * Arrête une boucle de plan en cours pour un client/service
 */
function stopPlan(clientId, serviceId) {
  return planLoopManager.stop(clientId, serviceId);
}

/**
 * Arrête une boucle de plan (alias)
 */
function stopPlanLoop(clientId, serviceId) {
  return planLoopManager.stop(clientId, serviceId);
}

/**
 * Annule un job Terraform en cours par jobId
 */
function cancelJob(jobId) {
  return jobManager.cancelJob(jobId);
}

/**
 * Exécute un plan tofu pour le réseau et retourne OpenTofuStatus
 */
async function checkNetworkStatus(clientId, bucket, key) {
  return NetworkService.checkStatus(clientId, bucket, key);
}

// === UTILITAIRES ===

/**
 * Obtient les statistiques du service
 */
function getStats() {
  return {
    activeJobs: jobManager.getActiveJobs().length,
    activePlanLoops: planLoopManager.getActiveLoops().length,
    jobIds: jobManager.getActiveJobs(),
    planLoopKeys: planLoopManager.getActiveLoops()
  };
}

/**
 * Nettoie toutes les ressources pour un client
 */
function cleanupClient(clientId) {
  planLoopManager.stopAllForClient(clientId);
}

module.exports = {
  OPENTOFU_CODE_DIR,
  NETWORK_CODE_DIR,
  
  listBuckets,
  listClients,
  listServices,
  createFile,
  checkNetworkConfigExists,
  
  executePlan,
  executeAction,
  stopPlan,
  stopPlanLoop,
  cancelJob,
  checkNetworkStatus,
  
  getStats,
  cleanupClient
};