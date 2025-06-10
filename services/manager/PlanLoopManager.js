/**
 * Manager for continuous Terraform plan loops
 * Handles starting, stopping, and monitoring plan execution loops
 */
const { sendToClients } = require('../../sse/clients');
const OpenTofuStatus = require('../../models/OpenTofuStatus');
const s3Service = require('../s3/S3Service');
const InstanceConfig = require('../../models/InstanceConfig');
const NetworkService = require('../NetworkService');
const instanceManager = require('./InstanceManager');
const { OPENTOFU_CODE_DIR } = require('../../config/paths');
const { DefaultValues, isNetworkService } = require('../../config/constants');
const PathHelper = require('../../utils/pathHelper');

class PlanLoopManager {
  constructor() {
    this.planLoops = new Map();
  }

  /**
   * Starts a continuous plan loop for a service
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} dataDir - Working directory path
   * @param {number} intervalMs - Loop interval in milliseconds
   * @returns {void}
   */
  start(clientId, serviceId, dataDir, intervalMs = DefaultValues.PLAN_INTERVAL_MS) {
    const key = `${clientId}/${serviceId}`;

    // Stop existing loop if it exists
    if (this.planLoops.has(key)) {
      this.stop(clientId, serviceId);
    }

    const runner = instanceManager.getInstance(clientId, serviceId, dataDir, OPENTOFU_CODE_DIR);

    const intervalId = setInterval(async () => {
      try {
        // Check network readiness for non-network services
        if (!isNetworkService(serviceId)) {
          await this._checkNetworkReadiness(clientId, serviceId);
        }

        // Execute plan and create status
        const planOutput = await runner.runPlan();
        const lastAction = await this._getLastAction(clientId, serviceId);
        const status = OpenTofuStatus.fromPlanOutput(key, planOutput, lastAction);

        // Send to clients and save
        await this._updateAndNotify(clientId, serviceId, status);

      } catch (err) {
        await this._handlePlanError(clientId, serviceId, key, err);
      }
    }, intervalMs);

    this.planLoops.set(key, intervalId);
  }

  /**
   * Stops the plan loop for a service
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @returns {boolean} True if loop was stopped, false if not found
   */
  stop(clientId, serviceId) {
    const key = `${clientId}/${serviceId}`;
    const intervalId = this.planLoops.get(key);

    if (!intervalId) return false;

    clearInterval(intervalId);
    this.planLoops.delete(key);
    return true;
  }

  /**
   * Stops all plan loops for a client
   * @param {string} clientId - Client identifier
   * @returns {void}
   */
  stopAllForClient(clientId) {
    for (const key of this.planLoops.keys()) {
      if (key.startsWith(`${clientId}/`)) {
        const serviceId = key.substring(clientId.length + 1);
        this.stop(clientId, serviceId);
      }
    }
  }

  /**
   * Gets all active plan loop keys
   * @returns {string[]} Array of active loop keys
   */
  getActiveLoops() {
    return Array.from(this.planLoops.keys());
  }

  /**
   * Checks if network is ready for non-network services
   * @private
   */
  async _checkNetworkReadiness(clientId, serviceId) {
    const configKey = PathHelper.getServiceConfigKey(clientId, serviceId);
    const instanceRaw = await s3Service.getFile(process.env.S3_BUCKET, configKey);
    const instanceJson = JSON.parse(instanceRaw);
    const instanceConfig = new InstanceConfig(instanceJson.instance || instanceJson);
    await NetworkService.checkIsReady(clientId, instanceConfig, process.env.S3_BUCKET);
  }

  /**
   * Gets the last action from service info
   * @private
   */
  async _getLastAction(clientId, serviceId) {
    try {
      const existingInfo = await s3Service.getServiceInfo(process.env.S3_BUCKET, clientId, serviceId);
      return existingInfo?.lastAction || 'plan';
    } catch (err) {
      return 'plan';
    }
  }

  /**
   * Updates service status and notifies clients
   * @private
   */
  async _updateAndNotify(clientId, serviceId, status) {
    sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()));
    await s3Service.updateServiceStatus(process.env.S3_BUCKET, clientId, serviceId, status.toJSON());
  }

  /**
   * Handles plan execution errors
   * @private
   */
  async _handlePlanError(clientId, serviceId, key, err) {
    const lastAction = await this._getLastAction(clientId, serviceId);
    const errorStatus = OpenTofuStatus.fromError(key, '', err, lastAction);

    await s3Service.updateServiceStatus(process.env.S3_BUCKET, clientId, serviceId, errorStatus.toJSON());
    sendToClients(clientId, serviceId, JSON.stringify(errorStatus.toJSON()));
    this.stop(clientId, serviceId);
  }
}

module.exports = new PlanLoopManager();