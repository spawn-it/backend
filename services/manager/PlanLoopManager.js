const { sendToClients } = require('../../sse/clients');
const OpenTofuStatus = require('../../models/OpenTofuStatus');
const s3 = require('../s3');
const InstanceConfig = require('../../models/InstanceConfig');
const NetworkService = require('../NetworkService');
const instanceManager = require('../manager/InstanceManager');

const OPENTOFU_CODE_DIR = require('../../config/paths').OPENTOFU_CODE_DIR;

class PlanLoopManager {
  constructor() {
    this.planLoops = new Map();
  }

  /**
   * Démarre la boucle plan continue
   */
  start(clientId, serviceId, dataDir, intervalMs = 10000) {
    const key = `${clientId}/${serviceId}`;
    
    // Arrêter la boucle existante si elle existe
    if (this.planLoops.has(key)) {
      this.stop(clientId, serviceId);
    }

    const runner = instanceManager.getInstance(clientId, serviceId, dataDir, OPENTOFU_CODE_DIR);

    const intervalId = setInterval(async () => {
      console.log(`[TOFU] Boucle plan tick pour ${key}`);

      try {
        // Vérifier le réseau seulement pour les services (pas pour les réseaux)
        if (!this._isNetworkService(serviceId)) {
          const instanceRaw = await s3.getFile(
            process.env.S3_BUCKET, 
            `clients/${clientId}/${serviceId}/terraform.tfvars.json`
          );
          const instanceJson = JSON.parse(instanceRaw);
          const instanceConfig = new InstanceConfig(instanceJson.instance || instanceJson);
          await NetworkService.checkIsReady(clientId, instanceConfig, process.env.S3_BUCKET);
        }

        const status = await runner.runPlan();
        sendToClients(clientId, serviceId, JSON.stringify(status.toJSON()));
      } catch (err) {
        const errorStatus = OpenTofuStatus.fromError(key, '', err);
        sendToClients(clientId, serviceId, JSON.stringify(errorStatus.toJSON()));
      }
    }, intervalMs);

    this.planLoops.set(key, intervalId);
    console.log(`[TOFU] plan loop started for ${key}`);
  }

  /**
   * Arrête la boucle plan
   */
  stop(clientId, serviceId) {
    const key = `${clientId}/${serviceId}`;
    const intervalId = this.planLoops.get(key);
    
    if (!intervalId) return false;
    
    clearInterval(intervalId);
    this.planLoops.delete(key);
    console.log(`[TOFU] plan loop stopped for ${key}`);
    return true;
  }

  /**
   * Arrête toutes les boucles pour un client
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
   * Vérifie si le service est un service réseau
   */
  _isNetworkService(serviceId) {
    return serviceId.startsWith('network/');
  }

  /**
   * Obtient toutes les boucles actives
   */
  getActiveLoops() {
    return Array.from(this.planLoops.keys());
  }
}

module.exports = new PlanLoopManager();