const path = require('path');
const fs = require('fs').promises;
const s3 = require('./s3');

const BASE_WORKING_DIR = path.resolve(process.env.TOFU_WORKING_DIR || './workdirs');

class WorkingDirectoryService {
  /**
   * Prepare the working directory for a client and service.
   * @param {string} clientId the client identifier
   * @param {string} serviceId the service identifier
   * @param {string} bucket the S3 bucket name
   * @returns {Promise<string>} the path to the prepared working directory
   */
  static async prepare(clientId, serviceId, bucket) {
    const safeServiceId = serviceId.replace(/\//g, path.sep);
    const dataDir = path.join(BASE_WORKING_DIR, clientId, safeServiceId);
    const s3Prefix = `clients/${clientId}/${serviceId}/`;
    
    await fs.mkdir(dataDir, { recursive: true });
    await s3.downloadFiles(bucket, s3Prefix, dataDir);
    
    console.log(`[TOFU] Répertoire de travail préparé pour ${clientId}/${serviceId} : ${dataDir}`);
    return dataDir;
  }
}

module.exports = WorkingDirectoryService;