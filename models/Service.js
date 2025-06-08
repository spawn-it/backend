const OpenTofuStatus = require('./OpenTofuStatus');
const InstanceConfig = require('./InstanceConfig');

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'spawn-it-bucket';

class Service {
  constructor(clientId, serviceId) {
    this.clientId = clientId;
    this.serviceId = serviceId;
    this.status = null; // OpenTofuStatus
    this.config = null; // InstanceConfig
  }
}

module.exports = Service;