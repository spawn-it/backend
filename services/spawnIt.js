const s3 = require('./s3');
const tofuService = require('./opentofu');

/**
 * OrchestratorService: combine S3 storage and Terraform operations without coupling them.
 */
module.exports = {
  /**
   * List all available buckets in S3.
   */
  listBuckets: async () => {
    return s3.listBuckets();
  },
  
  /**
   * List clients in a specific bucket.
   * @param {string} bucket
   */
  listClients: async (bucket) => {
    return s3.listClients(bucket);
  },
  
  /**
   * List services for a given client in a bucket.
   * @param {string} bucket
   * @param {string} clientId
   */
  listServices: async (bucket, clientId) => {
    return s3.listServices(bucket, clientId);
  },

  /**
   *
   */
  createFile: async (bucket, key, content) => {
    return s3.createFile(bucket, key, content);
  },
  /**
   * Prepare working directory and start a continuous Terraform plan loop.
   * @param {string} clientId
   * @param {string} serviceId
   * @param {string} bucket
   */
  executePlan: async (clientId, serviceId, bucket) => {
    return tofuService.executePlan(clientId, serviceId, bucket);
  },
  
  /**
   * Execute a Terraform action (plan, apply, destroy) for a client/service.
   * @param {string} action
   * @param {string} clientId
   * @param {string} serviceId
   * @param {string} bucket
   * @param {object} res - Express response object to stream jobId
   * @param {string} [opentofuCodeDir=tofuService.OPENTOFU_CODE_DIR] - Directory containing OpenTofu code
   */
  executeAction: async (action, clientId, serviceId, bucket, res, opentofuCodeDir = tofuService.OPENTOFU_CODE_DIR) => {
    return tofuService.executeAction(action, clientId, serviceId, bucket, res, opentofuCodeDir);
  },
  
  /**
   * Stop an ongoing plan loop for a client/service.
   * @param {string} clientId
   * @param {string} serviceId
   */
  stopPlan: (clientId, serviceId) => {
    tofuService.stopPlanLoop(clientId, serviceId);
  },
  
  /**
   * Cancel a running Terraform job by jobId.
   * @param {string} jobId
   */
  cancelJob: (jobId) => {
    tofuService.cancelJob(jobId);
  }
};