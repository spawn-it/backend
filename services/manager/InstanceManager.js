/**
 * Instance Manager for OpenTofu command instances
 * Manages creation and lifecycle of OpenTofuCommand instances
 */
const OpenTofuCommand = require('../../utils/opentofu');

class InstanceManager {
  constructor() {
    this.instances = new Map();
  }

  /**
   * Gets an existing instance or creates a new OpenTofuCommand instance
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @param {string} dataDir - Data directory path
   * @param {string} codeDir - Code directory path
   * @returns {OpenTofuCommand} OpenTofu command instance
   */
  getInstance(clientId, serviceId, dataDir, codeDir) {
    const key = `${clientId}/${serviceId}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, new OpenTofuCommand(clientId, serviceId, codeDir, dataDir));
    }
    return this.instances.get(key);
  }

  /**
   * Removes an instance from the manager
   * @param {string} clientId - Client identifier
   * @param {string} serviceId - Service identifier
   * @returns {boolean} True if instance was removed
   */
  removeInstance(clientId, serviceId) {
    const key = `${clientId}/${serviceId}`;
    return this.instances.delete(key);
  }

  /**
   * Removes all instances for a specific client
   * @param {string} clientId - Client identifier
   * @returns {number} Number of instances removed
   */
  removeClientInstances(clientId) {
    let removedCount = 0;
    for (const key of this.instances.keys()) {
      if (key.startsWith(`${clientId}/`)) {
        this.instances.delete(key);
        removedCount++;
      }
    }
    return removedCount;
  }
}

module.exports = new InstanceManager();