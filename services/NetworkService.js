const s3 = require('./s3');
const WorkingDirectoryService = require('./WorkingDirectoryService');
const instanceManager = require('./manager/InstanceManager');

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

    const status = await networkRunner.runPlan();
    if (!status.isCompliant()) {
      throw new Error(`Network for client ${clientId} provider ${provider} is not ready: ${status.state}`);
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
          isCompliant: () => false,
          toJSON: () => ({ 
            compliant: false, 
            state: 'missing_config', 
            message: 'Configuration réseau manquante' 
          })
        };
      }
      throw err;
    }

    // Extraire le provider du chemin
    const pathParts = key.split('/');
    const provider = pathParts[pathParts.length - 2]; // network/[provider]/terraform.tfvars.json
    
    const dataDir = await WorkingDirectoryService.prepare(clientId, `network/${provider}`, bucket);
    const runner = instanceManager.getInstance(clientId, `network/${provider}`, dataDir, NETWORK_CODE_DIR);
    
    try {
      await runner.ensureInitialized();
      return await runner.runPlan();
    } catch (err) {
      console.error(`[TOFU] Error running plan for network ${clientId}/${provider}:`, err);
      return {
        isCompliant: () => false,
        toJSON: () => ({ 
          compliant: false, 
          state: 'error', 
          message: err.message 
        })
      };
    }
  }
}

module.exports = NetworkService;