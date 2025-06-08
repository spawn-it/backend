const s3 = require('./s3');
const WorkingDirectoryService = require('./WorkingDirectoryService');
const instanceManager = require('./manager/InstanceManager');
const OpenTofuStatus = require('../models/OpenTofuStatus');

const NETWORK_CODE_DIR = require('../config/paths').NETWORK_CODE_DIR;

class NetworkService {
  /**
   * Vérifie que le réseau spécifique au provider est prêt (pas de changement planifié)
   * @param {string} clientId
   * @param {InstanceConfig} instanceConfig
   * @param {string} bucket
   */
  static async checkIsReady(clientId, instanceConfig, bucket) {
    if (!instanceConfig.provider || !instanceConfig.network_name) {
      throw new Error(`InstanceConfig missing provider or network_name`);
    }

    const provider = instanceConfig.provider;
    const key = `clients/${clientId}/network/${provider}/terraform.tfvars.json`;

    // Vérifier que la config réseau existe
    try {
      await s3.getFile(bucket, key);
    } catch (err) {
      throw new Error(`Network configuration missing for client ${clientId} and provider ${provider}`);
    }

    // Préparer répertoire réseau
    const networkDataDir = await WorkingDirectoryService.prepare(clientId, `network/${provider}`, bucket);
    const networkRunner = instanceManager.getInstance(clientId, `network/${provider}`, networkDataDir, NETWORK_CODE_DIR);

    // Initialiser (si besoin)
    await networkRunner.ensureInitialized();

    // runPlan() retourne maintenant une string, pas un OpenTofuStatus
    const planOutput = await networkRunner.runPlan();
    
    // Récupérer la dernière action depuis S3 si elle existe
    let lastAction = 'plan';
    try {
      const existingInfo = await s3.getInfoJson(bucket, clientId, `network/${provider}`);
      if (existingInfo && existingInfo.lastAction) {
        lastAction = existingInfo.lastAction;
      }
    } catch (infoErr) {
      // Pas grave si on ne peut pas récupérer l'info existante
    }

    // Créer le status depuis l'output du plan
    const status = OpenTofuStatus.fromPlanOutput(`${clientId}/network/${provider}`, planOutput, lastAction);

    if (!status.applied) {
      throw new Error(`Network for client ${clientId} provider ${provider} is not ready. Plan output: ${planOutput.substring(0, 200)}...`);
    }

    console.log(`[TOFU] Network for client ${clientId} provider ${provider} is ready.`);
  }

  /**
   * Vérifie le statut du réseau avec gestion d'erreur améliorée
   */
  static async checkStatus(clientId, bucket, key) {
    try {
      // Vérifier que le fichier existe d'abord
      await s3.getFile(bucket, key);
    } catch (err) {
      if (err.code === 'NoSuchKey') {
        // Retourner un statut "non compliant" au lieu de lever une erreur
        return {
          compliant: false,
          applied: false,
          key: `${clientId}/network`,
          lastAction: 'unknown',
          output: 'Configuration réseau manquante',
          timestamp: new Date().toISOString(),
          errorMessage: 'Configuration réseau manquante',
          errorStack: null
        };
      }
      throw err;
    }
  
    // Extraire le provider du chemin
    const pathParts = key.split('/');
    const provider = pathParts[pathParts.length - 2]; // network/[provider]/terraform.tfvars.json
    const serviceId = `network/${provider}`;
    
    const dataDir = await WorkingDirectoryService.prepare(clientId, serviceId, bucket);
    const runner = instanceManager.getInstance(clientId, serviceId, dataDir, NETWORK_CODE_DIR);
    
    try {
      await runner.ensureInitialized();
      
      // runPlan() retourne maintenant une string, pas un OpenTofuStatus
      const planOutput = await runner.runPlan();
      
      // Récupérer la dernière action depuis S3 si elle existe
      let lastAction = 'plan';
      try {
        const existingInfo = await s3.getInfoJson(bucket, clientId, serviceId);
        if (existingInfo && existingInfo.lastAction) {
          lastAction = existingInfo.lastAction;
        }
      } catch (infoErr) {
        // Pas grave si on ne peut pas récupérer l'info existante
      }
      
      // Créer le status depuis l'output et retourner le JSON
      const status = OpenTofuStatus.fromPlanOutput(`${clientId}/${serviceId}`, planOutput, lastAction);
      return status.toJSON();
      
    } catch (err) {
      console.error(`[TOFU] Error running plan for network ${clientId}/${provider}:`, err);
      
      const errorStatus = OpenTofuStatus.fromError(`${clientId}/${serviceId}`, '', err, 'plan');
      return errorStatus.toJSON();
    }
  }
}

module.exports = NetworkService;