/**
 * OpenTofu Executor - Handles OpenTofu command execution and management
 * Manages action execution, network validation, and plan loops
 */
const OpenTofuStatus = require('../../models/OpenTofuStatus');
const InstanceConfig = require('../../models/InstanceConfig');
const { sendToClients } = require('../../sse/clients');
const s3Service = require('../s3/S3Service');
const workingDirectoryService = require('../WorkingDirectoryService');
const NetworkService = require('../NetworkService');
const instanceManager = require('../manager/InstanceManager');
const jobManager = require('../manager/JobManager');
const planLoopManager = require('../manager/PlanLoopManager');
const { isNetworkService } = require('../../config/constants');
const PathHelper = require('../../utils/pathHelper');

const { OPENTOFU_CODE_DIR } = require('../../config/paths');

class OpentofuExecutor {
  /**
   * Executes an OpenTofu action (plan, apply, destroy)
   * Validates network readiness before executing actions on non-network services
   * @param {string} action - Action to execute
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} bucket - S3 bucket name
   * @param {Object} res - Express response object
   * @param {string} codeDir - OpenTofu code directory
   * @returns {Promise<void>}
   */
  static executeAction(action, clientId, serviceId, bucket, res = null, codeDir = OPENTOFU_CODE_DIR) {
    return new Promise(async (resolve, reject) => {
      try {
        const dataDir = await workingDirectoryService.prepare(clientId, serviceId, bucket);
        const isNetwork = isNetworkService(serviceId);

        let instanceConfig = null;
        if (!isNetwork) {
          instanceConfig = await this._getInstanceConfig(clientId, serviceId, bucket);
          if (!instanceConfig) {
            if (res && !res.headersSent) res.status(500).json({ error: `Missing configuration for ${serviceId}` });
            return reject(new Error('Missing configuration'));
          }
        }

        planLoopManager.stop(clientId, serviceId);

        if (!isNetwork && instanceConfig) {
          await NetworkService.checkIsReady(clientId, instanceConfig, bucket);
        }

        const runner = instanceManager.getInstance(clientId, serviceId, dataDir, codeDir);
        const jobId = jobManager.createJob();
        const proc = await runner.spawnCommand(action);
        jobManager.setJob(jobId, proc);

        if (res && !res.headersSent) res.json({ jobId });

        let output = '';

        proc.stdout.on('data', c => {
          const t = c.toString();
          output += t;
          sendToClients(clientId, serviceId, t, 'data');
        });

        proc.stderr.on('data', c => {
          const t = c.toString();
          output += t;
          sendToClients(clientId, serviceId, t, 'error');
        });

        proc.on('close', async code => {
          jobManager.removeJob(jobId);

          const status = this._createStatusFromResult(clientId, serviceId, action, output, code);
          const tofuVarOutput = await runner.spawnOutput()
          await s3Service.updateServiceLastApplyOutput(bucket, clientId, serviceId, tofuVarOutput);
          await s3Service.updateServiceStatus(bucket, clientId, serviceId, status.toJSON());
          if (action !== 'plan' && code === 0) {
            await s3Service.updateServiceLastAction(bucket, clientId, serviceId, action);
          }

          sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()), 'end');
          planLoopManager.start(clientId, serviceId, dataDir);

          return code === 0 ? resolve(status) : reject(new Error(`${action} exited with code ${code}`));
        });

        proc.on('error', err => {
          jobManager.removeJob(jobId);
          const status = OpenTofuStatus.fromError(`${clientId}/${serviceId}`, output, err, action);
          sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()), 'error');
          if (res && !res.headersSent) res.status(500).json({ error: err.message });
          reject(err);
        });
      } catch (err) {
        if (res && !res.headersSent) res.status(500).json({ error: err.message });
        reject(err);
      }
    });
  }

  /**
   * Starts a plan loop for continuous monitoring
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} bucket - S3 bucket name
   * @returns {Promise<Object>} Status object with directory information
   */
  static async executePlan(clientId, serviceId, bucket) {
    const dataDir = await workingDirectoryService.prepare(clientId, serviceId, bucket);
    planLoopManager.start(clientId, serviceId, dataDir);

    return {
      status: 'started',
      codeDir: OPENTOFU_CODE_DIR,
      dataDir
    };
  }

  /**
   * Retrieves and parses instance configuration from S3
   * @private
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} bucket - S3 bucket name
   * @returns {Promise<InstanceConfig|null>} Instance configuration or null if error
   */
  static async _getInstanceConfig(clientId, serviceId, bucket) {
    try {
      const configKey = PathHelper.getServiceConfigKey(clientId, serviceId);
      const instanceRaw = await s3Service.getFile(bucket, configKey);
      const instanceJson = JSON.parse(instanceRaw);
      return new InstanceConfig(instanceJson.instance || instanceJson);
    } catch (err) {
      console.error(`[OpentofuExecutor] Error reading instance config for ${clientId}/${serviceId}:`, err);
      return null;
    }
  }

  /**
   * Creates appropriate status object based on command result
   * @private
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} action - Action that was executed
   * @param {string} output - Command output
   * @param {number} code - Exit code
   * @returns {OpenTofuStatus} Status object
   */
  static _createStatusFromResult(clientId, serviceId, action, output, code) {
    const key = `${clientId}/${serviceId}`;

    if (code === 0) {
      // Success - create status based on action type
      if (action === 'plan') {
        return OpenTofuStatus.fromPlanOutput(key, output, action);
      } else {
        // For apply, destroy, etc. - assume it's applied
        return new OpenTofuStatus(key, action, output, new Date(), null, true);
      }
    } else {
      // Error - create error status
      return OpenTofuStatus.fromError(
          key,
          output,
          new Error(`${action} exited with code ${code}`),
          action
      );
    }
  }
}

module.exports = OpentofuExecutor;