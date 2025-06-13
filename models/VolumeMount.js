const BaseModel = require('./BaseModel');

class VolumeMount extends BaseModel {
  /**
   * @param {object} params
   * @param {string} params.host_path
   * @param {string} params.container_path
   */
  constructor({ host_path, container_path }) {
    super();
    if (typeof host_path !== 'string')
      throw new TypeError('host_path must be string');
    if (typeof container_path !== 'string')
      throw new TypeError('container_path must be string');
    this.host_path = host_path;
    this.container_path = container_path;
  }
}

module.exports = VolumeMount;
