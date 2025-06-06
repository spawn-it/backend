const path = require('path');
const fs = require('fs').promises;
const s3 = require('./s3');

const BASE_WORKING_DIR = path.resolve(process.env.TOFU_WORKING_DIR || './workdirs');

class WorkingDirectoryService {
  /**
   * Prépare le répertoire de travail local en téléchargeant les fichiers depuis S3
   * @param {string} clientId
   * @param {string} serviceId (peut être 'network/local', etc.)
   * @param {string} bucket
   * @returns {Promise<string>} chemin du répertoire local
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