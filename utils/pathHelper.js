/**
 * Utility functions for path construction and validation
 */
const { S3Config } = require('../config/constants');

class PathHelper {
    /**
     * Constructs S3 key for client service configuration
     * @param {string} clientId - Client identifier
     * @param {string} serviceId - Service identifier
     * @param {string} filename - Configuration filename
     * @returns {string} S3 key path
     */
    static getServiceConfigKey(clientId, serviceId, filename = S3Config.TFVARS_FILE) {
        return `${S3Config.BASE_PREFIX}${clientId}/${serviceId}/${filename}`;
    }

    /**
     * Constructs S3 key for service info file
     * @param {string} clientId - Client identifier
     * @param {string} serviceId - Service identifier
     * @returns {string} S3 key path for info.json
     */
    static getServiceInfoKey(clientId, serviceId) {
        return this.getServiceConfigKey(clientId, serviceId, S3Config.INFO_FILE);
    }

    /**
     * Constructs S3 key for network configuration
     * @param {string} clientId - Client identifier
     * @param {string} provider - Cloud provider
     * @returns {string} S3 key path for network config
     */
    static getNetworkConfigKey(clientId, provider) {
        return `${S3Config.BASE_PREFIX}${clientId}/${S3Config.NETWORK_PREFIX}${provider}/${S3Config.TFVARS_FILE}`;
    }

    /**
     * Constructs service prefix for S3 operations
     * @param {string} clientId - Client identifier
     * @param {string} serviceId - Service identifier
     * @returns {string} S3 prefix path
     */
    static getServicePrefix(clientId, serviceId) {
        return `${S3Config.BASE_PREFIX}${clientId}/${serviceId}/`;
    }

    /**
     * Constructs network service ID from provider
     * @param {string} provider - Cloud provider
     * @returns {string} Network service identifier
     */
    static getNetworkServiceId(provider) {
        return `${S3Config.NETWORK_PREFIX}${provider}`;
    }
}

module.exports = PathHelper;