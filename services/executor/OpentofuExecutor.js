const OpenTofuStatus = require('../../models/OpenTofuStatus');
const InstanceConfig = require('../../models/InstanceConfig');
const { sendToClients } = require('../../sse/clients');
const s3Service = require('../s3');
const WorkingDirectoryService = require('../WorkingDirectoryService');
const NetworkService = require('../NetworkService');
const instanceManager = require('../manager/InstanceManager');
const jobManager = require('../manager/JobManager');
const planLoopManager = require('../manager/PlanLoopManager');

const OPENTOFU_CODE_DIR = require('../../config/paths').OPENTOFU_CODE_DIR;

class OpentofuExecutor {
  /**
   * Exécute une action opentofu (plan, apply, destroy)
   * Vérifie la préparation du réseau avant d'exécuter l'action sur un service autre que réseau
   */
  static async executeAction(action, clientId, serviceId, bucket, res, codeDir = OPENTOFU_CODE_DIR) {
    const dataDir = await WorkingDirectoryService.prepare(clientId, serviceId, bucket);
    
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

    planLoopManager.stop(clientId, serviceId);
    const runner = instanceManager.getInstance(clientId, serviceId, dataDir, codeDir);

    try {
      const jobId = jobManager.createJob();

      // Vérifier que le réseau est prêt seulement pour les services (pas pour les actions réseau)
      if (!isNetworkAction && instanceConfig) {
        await NetworkService.checkIsReady(clientId, instanceConfig, bucket);
      }

      res.json({ jobId });
      const proc = await runner.spawnCommand(action);
      jobManager.setJob(jobId, proc);

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
        jobManager.removeJob(jobId);
        const status = code === 0
          ? new OpenTofuStatus(`${clientId}/${serviceId}`, 'success', output)
          : OpenTofuStatus.fromError(`${clientId}/${serviceId}`, output, new Error(`${action} exited with code ${code}`));

        sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()), 'end');

        if (action === 'apply') {
          // planLoopManager.start(clientId, serviceId, dataDir);
        }
      });

      proc.on('error', err => {
        jobManager.removeJob(jobId);
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
  static async executePlan(clientId, serviceId, bucket) {
    const dataDir = await WorkingDirectoryService.prepare(clientId, serviceId, bucket);
    planLoopManager.start(clientId, serviceId, dataDir);
    return { 
      status: 'started', 
      codeDir: OPENTOFU_CODE_DIR, 
      dataDir 
    };
  }
}

module.exports = OpentofuExecutor;