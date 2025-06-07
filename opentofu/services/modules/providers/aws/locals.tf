locals {
  processed_ports = [
    for internal_port_str, external_port_str in var.docker_instance_config.ports : {
      internal = tonumber(internal_port_str)
      external = tonumber(external_port_str)
      protocol = internal_port_str == "27960" ? "tcp" : "tcp"
    }
  ]

  // Variables d'environnement formatées pour la commande docker run
  formatted_env_vars = [for k, v in var.docker_instance_config.env_vars : "-e \"${k}=${v}\""]

  // Commandes de port formatées pour la commande docker run
  formatted_port_mappings = [
    for p in local.processed_ports : "-p ${p.external}:${p.internal}"
  ]

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

DOCKER_RUN_CMD="docker run -d --restart always \\
  ${join(" \\\n  ", local.formatted_env_vars)} \\
  ${join(" \\\n  ", local.formatted_port_mappings)} \\
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \\
  $${IMAGE_NAME} ${join(" ", var.docker_instance_config.command)}"

echo "Executing Docker command:"
echo "$${DOCKER_RUN_CMD}"
eval "$${DOCKER_RUN_CMD}"

echo "Generic Docker user_data script completed."
EOF

  final_user_data = var.custom_user_data_script != null ? var.custom_user_data_script : local.generic_docker_user_data

  // --- Locals pour les outputs ---
  web_port_list = [
    for p in local.processed_ports : p if p.internal == 80 && lower(p.protocol) == "tcp"
  ]
  first_tcp_port_list = [
    for p in local.processed_ports : p if lower(p.protocol) == "tcp"
  ]
  actual_primary_port_info = length(local.web_port_list) > 0 ? local.web_port_list[0] : (
    length(local.first_tcp_port_list) > 0 ? local.first_tcp_port_list[0] : null
  )
}
