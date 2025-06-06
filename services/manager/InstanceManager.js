const OpenTofuCommand = require('../../utils/opentofu');

class InstanceManager {
  constructor() {
    this.instances = new Map();
  }

  /**
   * Obtient ou crée une instance OpenTofuCommand
   */
  getInstance(clientId, serviceId, dataDir, codeDir) {
    const key = `${clientId}/${serviceId}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new OpenTofuCommand(clientId, serviceId, codeDir, dataDir));
    }
    return this.instances.get(key);
  }

  /**
   * Supprime une instance
   */
  removeInstance(clientId, serviceId) {
    const key = `${clientId}/${serviceId}`;
    this.instances.delete(key);
  }

  /**
   * Supprime toutes les instances pour un client
   */
  removeClientInstances(clientId) {
    for (const key of this.instances.keys()) {
      if (key.startsWith(`${clientId}/`)) {
        this.instances.delete(key);
      }
    }
  }
}

module.exports = new InstanceManager();