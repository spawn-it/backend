
# Defines local variables used within the AWS provider module for processing inputs and generating configurations.
locals {
  # Transforms the input `docker_instance_config.ports` map (string keys/values)
  # into a list of objects, converting port numbers and determining the protocol.
  processed_ports = [
    for internal_port_str, external_port_str in var.docker_instance_config.ports : {
      internal = tonumber(internal_port_str)
      external = tonumber(external_port_str)
      protocol = internal_port_str == "27960" ? "tcp" : "tcp"
    }
  ]

  # Formats environment variables for the 'docker run' command.
  # Example: { "KEY": "VALUE" } becomes ["-e \"KEY=VALUE\""].
  formatted_env_vars = [for k, v in var.docker_instance_config.env_vars : "-e \"${k}=${v}\""]

  # Formats port mappings for the 'docker run' command.
  # Example: { internal = 80, external = 8080 } becomes ["-p 8080:80"].
  formatted_port_mappings = [
    for p in local.processed_ports : "-p ${p.external}:${p.internal}"
  ]

  # Formats volume mounts for the 'docker run' command.
  # Example: { host_path = "/opt/data", container_path = "/data" } becomes ["-v /opt/data:/data"].
  formatted_volume_mounts = [
    for vm in var.docker_instance_config.volume_mounts : "-v ${vm.host_path}:${vm.container_path}"
  ]

  # Generic user_data script for EC2 instances to set up Docker and run a specified container.
  # This script is used if `var.custom_user_data_script` is not provided.
  generic_docker_user_data = <<-EOF
#!/bin/bash
set -e
echo "Starting Generic Docker user_data script for ${var.docker_instance_config.image}"

apt-get update -y && apt-get install -y docker.io
systemctl start docker && systemctl enable docker
systemctl is-active --quiet docker || (echo "Docker failed to start"; exit 1)

IMAGE_NAME="${var.docker_instance_config.image}"
echo "Pulling Docker image: $${IMAGE_NAME}"
docker pull "$${IMAGE_NAME}"

%{if length(var.docker_instance_config.volume_mounts) > 0 ~}
echo "Creating host directories for volume mounts..."
%{for vm in var.docker_instance_config.volume_mounts ~}
mkdir -p "${vm.host_path}"
echo "Ensured host directory ${vm.host_path} exists."
%{endfor ~}
%{endif ~}

DOCKER_RUN_CMD="docker run -d --restart always \\
  ${join(" \\\n  ", local.formatted_env_vars)} \\
  ${join(" \\\n  ", local.formatted_port_mappings)} \\
  ${join(" \\\n  ", local.formatted_volume_mounts)} \\
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \\
  --name "${var.docker_instance_config.container_name}" \\
  $${IMAGE_NAME} ${join(" ", var.docker_instance_config.command)}"

echo "Executing Docker command:"
echo "$${DOCKER_RUN_CMD}"
eval "$${DOCKER_RUN_CMD}"

echo "Generic Docker user_data script completed."
EOF


  # Determines the final user_data script to be used by the EC2 instance.
  # Prioritizes a custom script if provided, otherwise falls back to the generic Docker setup.
  final_user_data = var.custom_user_data_script != null ? var.custom_user_data_script : local.generic_docker_user_data

  web_port_list = [
    for p in local.processed_ports : p if p.internal == 80 && lower(p.protocol) == "tcp"
  ]

  # Find all TCP ports from the processed_ports list.
  first_tcp_port_list = [
    for p in local.processed_ports : p if lower(p.protocol) == "tcp"
  ]
  
  # Determine the primary port for the access URL.
  actual_primary_port_info = length(local.web_port_list) > 0 ? local.web_port_list[0] : (
    length(local.first_tcp_port_list) > 0 ? local.first_tcp_port_list[0] : null
  )
}
