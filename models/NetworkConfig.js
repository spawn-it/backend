const BaseModel = require('./BaseModel');

class NetworkConfig extends BaseModel {
    constructor({ provider, network_name }) {
        super();
        if (typeof provider !== 'string') throw new TypeError('provider must be a string');
        if (typeof network_name !== 'string') throw new TypeError('network_name must be a string');
        this.provider = provider;
        this.network_name = network_name;
    }

    static fromInstanceConfig(instanceConfig) {
        return new NetworkConfig({
          provider: instanceConfig.provider,
          network_name: instanceConfig.network_name,
        });
      }
}

module.exports = NetworkConfig;
