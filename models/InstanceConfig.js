const BaseModel = require('./BaseModel');
const VolumeMount = require('./VolumeMount');

class InstanceConfig extends BaseModel {
  constructor({
    provider,
    container_name,
    image,
    ports,
    env_vars,
    command,
    volume_mounts = [],
    network_name,
  }) {
    super();
    this.provider = provider;
    this.container_name = container_name;
    this.image = image;
    this.ports = ports;
    this.env_vars = env_vars;
    this.command = command;
    this.volume_mounts = volume_mounts.map((vm) =>
      vm instanceof VolumeMount ? vm : VolumeMount.fromJSON(vm)
    );
    this.network_name = network_name;
  }
}

module.exports = InstanceConfig;
