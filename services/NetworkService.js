/**
 * Service for managing network infrastructure operations
 * Handles network readiness checks and status monitoring
 */
const s3Service = require('./s3/S3Service');
const workingDirectoryService = require('./WorkingDirectoryService');
const instanceManager = require('./manager/InstanceManager');
const OpenTofuStatus = require('../models/OpenTofuStatus');
const { NETWORK_CODE_DIR } = require('../config/paths');
const PathHelper = require('../utils/pathHelper');

class NetworkService {
  /**
   * Checks if the network infrastructure is ready for a specific provider
   * Validates that no changes are planned and infrastructure is applied
   * @param {string} clientId - Client identifier
   * @param {Object} instanceConfig - Instance configuration object
   * @param {string} bucket - S3 bucket name
   * @throws {Error} If network is not ready or configuration is missing
   */
  static async checkIsReady(clientId, instanceConfig, bucket) {
    if (!instanceConfig.provider || !instanceConfig.network_name) {
      throw new Error(`InstanceConfig missing provider or network_name`);
    }

    const provider = instanceConfig.provider;
    const key = PathHelper.getNetworkConfigKey(clientId, provider);

    // Verify network configuration exists
    try {
      await s3Service.getFile(bucket, key);
    } catch (err) {
      throw new Error(`Network configuration missing for client ${clientId} and provider ${provider}`);
    }

    // Prepare network directory
    const serviceId = PathHelper.getNetworkServiceId(provider);
    const networkDataDir = await workingDirectoryService.prepare(clientId, serviceId, bucket);
    const networkRunner = instanceManager.getInstance(clientId, serviceId, networkDataDir, NETWORK_CODE_DIR);

    // Initialize if needed
    await networkRunner.ensureInitialized();

    // Run plan and check status
    const planOutput = await networkRunner.runPlan();
    const lastAction = await this._getLastAction(bucket, clientId, serviceId);
    const status = OpenTofuStatus.fromPlanOutput(`${clientId}/${serviceId}`, planOutput, lastAction);

    if (!status.applied) {
      throw new Error(`Network for client ${clientId} provider ${provider} is not ready. Plan shows changes needed.`);
    }
  }

  /**
   * Checks the current status of network infrastructure
   * @param {string} clientId - Client identifier
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 key for network configuration
   * @returns {Promise<Object>} Network status object
   */
  static async checkStatus(clientId, bucket, key) {
    try {
      // Check if configuration file exists
      await s3Service.getFile(bucket, key);
    } catch (err) {
      if (err.code === 'NoSuchKey') {
        return {
          compliant: false,
          applied: false,
          key: `${clientId}/network`,
          lastAction: 'unknown',
          output: 'Network configuration missing',
          timestamp: new Date().toISOString(),
          errorMessage: 'Network configuration missing',
          errorStack: null
        };
      }
      throw err;
    }

    // Extract provider from path
    const pathParts = key.split('/');
    const provider = pathParts[pathParts.length - 2]; // network/[provider]/terraform.tfvars.json
    const serviceId = PathHelper.getNetworkServiceId(provider);

    const dataDir = await workingDirectoryService.prepare(clientId, serviceId, bucket);
    const runner = instanceManager.getInstance(clientId, serviceId, dataDir, NETWORK_CODE_DIR);

    try {
      await runner.ensureInitialized();

      const planOutput = await runner.runPlan();
      const lastAction = await this._getLastAction(bucket, clientId, serviceId);
      const status = OpenTofuStatus.fromPlanOutput(`${clientId}/${serviceId}`, planOutput, lastAction);

      return status.toJSON();

    } catch (err) {
      console.error(`[NetworkService] Error running plan for ${clientId}/${provider}:`, err);

      const errorStatus = OpenTofuStatus.fromError(`${clientId}/${serviceId}`, '', err, 'plan');
      return errorStatus.toJSON();
    }
  }

  /**
   * Gets the last action performed on a service
   * @private
   * @param {string} bucket - S3 bucket name
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @returns {Promise<string>} Last action or 'plan' as default
   */
  static async _getLastAction(bucket, clientId, serviceId) {
    try {
      const existingInfo = await s3Service.getServiceInfo(bucket, clientId, serviceId);
      return existingInfo?.lastAction || 'plan';
    } catch (err) {
      return 'plan';
    }
  }
}

module.exports = NetworkService;