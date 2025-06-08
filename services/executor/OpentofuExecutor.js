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

      proc.on('close', async (code) => {
        jobManager.removeJob(jobId);
        
        let status;
        if (code === 0) {
          // Succès - créer depuis l'output avec l'action correspondante
          if (action === 'plan') {
            status = OpenTofuStatus.fromPlanOutput(`${clientId}/${serviceId}`, output, action);
          } else {
            // Pour apply, destroy, etc. - on assume que c'est appliqué
            status = new OpenTofuStatus(`${clientId}/${serviceId}`, action, output, new Date(), null, true);
          }
        } else {
          // Erreur
          status = OpenTofuStatus.fromError(
            `${clientId}/${serviceId}`, 
            output, 
            new Error(`${action} exited with code ${code}`),
            action
          );
        }

        // Mettre à jour le status dans S3
        await s3Service.updateInfoJsonStatus(bucket, clientId, serviceId, status.toJSON());
        
        // Si c'est une action réelle (pas un plan), mettre à jour le lastAction au niveau du service
        if (action !== 'plan' && code === 0) {
          await s3Service.updateInfoJsonLastAction(bucket, clientId, serviceId, action);
        }

        sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()), 'end');
        planLoopManager.start(clientId, serviceId, dataDir);
      });

      proc.on('error', err => {
        jobManager.removeJob(jobId);
        const status = OpenTofuStatus.fromError(`${clientId}/${serviceId}`, output, err, action);
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