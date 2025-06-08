/**
 * Service for managing working directories for OpenTofu operations
 * Handles directory preparation and S3 file synchronization
 */
const path = require('path');
const fs = require('fs').promises;
const s3Service = require('./s3/S3Service');
const PathHelper = require('../utils/pathHelper');

class WorkingDirectoryService {
  constructor() {
    this.baseWorkingDir = path.resolve(process.env.TOFU_WORKING_DIR || './workdirs');
  }

  /**
   * Prepares the working directory for a client and service
   * Downloads all files from S3 to local working directory
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} bucket - S3 bucket name
   * @returns {Promise<string>} Path to the prepared working directory
   */
  async prepare(clientId, serviceId, bucket) {
    const safeServiceId = serviceId.replace(/\//g, path.sep);
    const dataDir = path.join(this.baseWorkingDir, clientId, safeServiceId);
    const s3Prefix = PathHelper.getServicePrefix(clientId, serviceId);

    await fs.mkdir(dataDir, { recursive: true });
    await s3Service.downloadFiles(bucket, s3Prefix, dataDir);

    return dataDir;
  }

  /**
   * Cleans up working directory for a specific service
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @returns {Promise<void>}
   */
  async cleanup(clientId, serviceId) {
    const safeServiceId = serviceId.replace(/\//g, path.sep);
    const dataDir = path.join(this.baseWorkingDir, clientId, safeServiceId);

    try {
      await fs.rm(dataDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[WorkingDir] Failed to cleanup ${dataDir}:`, err.message);
    }
  }

  /**
   * Cleans up all working directories for a client
   * @param {string} clientId - Client identifier
   * @returns {Promise<void>}
   */
  async cleanupClient(clientId) {
    const clientDir = path.join(this.baseWorkingDir, clientId);

    try {
      await fs.rm(clientDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[WorkingDir] Failed to cleanup client ${clientId}:`, err.message);
    }
  }
}

module.exports = new WorkingDirectoryService();