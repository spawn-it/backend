/**
 * Main OpenTofu Service - Central orchestrator for all OpenTofu operations
 * Provides high-level interface for infrastructure management
 */
const OpentofuExecutor = require('./executor/OpentofuExecutor');
const NetworkService = require('./NetworkService');
const jobManager = require('./manager/JobManager');
const planLoopManager = require('./manager/PlanLoopManager');
const s3Service = require('./s3/S3Service');
const workingDirectoryService = require('./WorkingDirectoryService');
const { OPENTOFU_CODE_DIR, NETWORK_CODE_DIR } = require('../config/paths');

class TofuService {
  /**
   * Lists all available S3 buckets
   * @returns {Promise<string[]>} Array of bucket names
   */
  async listBuckets() {
    return s3Service.listBuckets();
  }

  /**
   * Lists all clients in a specific bucket
   * @param {string} bucket - S3 bucket name
   * @returns {Promise<string[]>} Array of client identifiers
   */
  async listClients(bucket) {
    return s3Service.listClients(bucket);
  }

  /**
   * Lists all services for a specific client
   * @param {string} bucket - S3 bucket name
   * @param {string} clientId - Client identifier
   * @returns {Promise<Object>} Object mapping service IDs to their info
   */
  async listServices(bucket, clientId) {
    return s3Service.listServices(bucket, clientId);
  }

  /**
   * Creates a file in S3
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @param {string} content - File content
   * @returns {Promise<void>}
   */
  async createFile(bucket, key, content) {
    return s3Service.createFile(bucket, key, content);
  }

  /**
   * Deletes all files for a service
   * @param {string} bucket - S3 bucket name
   * @param {string} servicePrefix - S3 prefix for service files
   * @returns {Promise<void>}
   */
  async deleteServiceFiles(bucket, servicePrefix) {
    return s3Service.deleteServiceFiles(bucket, servicePrefix);
  }

  /**
   * Checks if network configuration file exists
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 key for network config
   * @returns {Promise<string>} File content
   */
  async checkNetworkConfigExists(bucket, key) {
    return s3Service.getFile(bucket, key);
  }

  /**
   * Starts a continuous plan loop for a service
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} bucket - S3 bucket name
   * @returns {Promise<void>}
   */
  async executePlan(clientId, serviceId, bucket) {
    return OpentofuExecutor.executePlan(clientId, serviceId, bucket);
  }

  /**
   * Executes a Terraform action (apply, destroy, plan)
   * @param {string} action - Action to execute
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} bucket - S3 bucket name
   * @param {Object} res - Express response object
   * @param {string} opentofuCodeDir - OpenTofu code directory
   * @returns {Promise<void>}
   */
  async executeAction(action, clientId, serviceId, bucket, res, opentofuCodeDir = OPENTOFU_CODE_DIR) {
    return OpentofuExecutor.executeAction(action, clientId, serviceId, bucket, res, opentofuCodeDir);
  }

  /**
   * Stops a running plan loop
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @returns {boolean} True if stopped, false if not found
   */
  stopPlan(clientId, serviceId) {
    return planLoopManager.stop(clientId, serviceId);
  }

  /**
   * Cancels a running job
   * @param {string} jobId - Job identifier
   * @returns {boolean} True if cancelled, false if not found
   */
  cancelJob(jobId) {
    return jobManager.cancelJob(jobId);
  }

  /**
   * Checks network infrastructure status
   * @param {string} clientId - Client identifier
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 key for network config
   * @returns {Promise<Object>} Network status object
   */
  async checkNetworkStatus(clientId, bucket, key) {
    return NetworkService.checkStatus(clientId, bucket, key);
  }

  /**
   * Gets service statistics and monitoring info
   * @returns {Object} Statistics object with active jobs and loops
   */
  getStats() {
    return {
      activeJobs: jobManager.getActiveJobs().length,
      activePlanLoops: planLoopManager.getActiveLoops().length,
      jobIds: jobManager.getActiveJobs(),
      planLoopKeys: planLoopManager.getActiveLoops()
    };
  }

  /**
   * Cleans up all resources for a specific client
   * @param {string} clientId - Client identifier
   * @returns {Promise<void>}
   */
  async cleanupClient(clientId) {
    planLoopManager.stopAllForClient(clientId);
    await workingDirectoryService.cleanupClient(clientId);
  }

  /**
   * Cleans up resources for a specific service
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async cleanupService(clientId, serviceId) {
    planLoopManager.stop(clientId, serviceId);
    await workingDirectoryService.cleanup(clientId, serviceId);
  }
}

module.exports = new TofuService();