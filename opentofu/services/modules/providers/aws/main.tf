terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
  owners = ["099720109477"] // Canonical's AWS account ID
}

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
}

resource "aws_security_group" "instance_sg" {
  name        = "sg-${var.docker_instance_config.container_name}"
  description = "Allow traffic for ${var.docker_instance_config.container_name}"
  # vpc_id = var.aws_config.vpc_id // Si on gère des VPC spécifiques

  dynamic "ingress" {
    for_each = local.processed_ports
    content {
      from_port   = ingress.value.external
      to_port     = ingress.value.external
      protocol    = ingress.value.protocol
      cidr_blocks = ["0.0.0.0/0"]
      description = "Port ${ingress.value.external}/${ingress.value.protocol} for ${var.docker_instance_config.container_name}"
    }
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # WARNING: Restrict
    description = "SSH access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sg-${var.docker_instance_config.container_name}"
    SpawnItService = var.docker_instance_config.container_name
  }
}

resource "aws_instance" "this" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.aws_config.instance_type
  associate_public_ip_address = true
  user_data                   = local.final_user_data
  key_name                    = var.aws_config.key_name
  vpc_security_group_ids      = [aws_security_group.instance_sg.id]
  // subnet_id = var.aws_config.subnet_id // Si on gère des sous-réseaux spécifiques

  tags = {
    Name           = var.docker_instance_config.container_name
    SpawnItService = var.docker_instance_config.container_name
    Image          = var.docker_instance_config.image
  }
}

// --- OUTPUTS ---
output "instance_id" {
  value = aws_instance.this.id
}

output "instance_public_ip" {
  value = aws_instance.this.public_ip
}

locals {
  // Essayer de trouver le premier port TCP pour game_url, sinon null
  primary_tcp_port = one([
    for p in local.processed_ports : p if lower(p.protocol) == "tcp"
    ]...) # ... déplie, one() s'assure qu'il y en a un ou lève une erreur (ou retourne null si la liste filtrée est vide et one() est appelé sur null)
          # On pourrait rendre ça plus robuste avec un try()
  primary_url_port_info = try(local.primary_tcp_port, null)
}

output "game_url" {
  description = "Primary HTTP/TCP access URL for the service"
  value = local.primary_url_port_info != null ? "http://${aws_instance.this.public_ip}:${local.primary_url_port_info.external}" : (
    length(local.processed_ports) > 0 ? "${local.processed_ports[0].protocol}://${aws_instance.this.public_ip}:${local.processed_ports[0].external}" : "No port info"
  )
}

output "all_ports_info" {
  description = "Information about all exposed ports"
  value = [
    for p in local.processed_ports : {
      external = p.external
      internal = p.internal
      protocol = p.protocol
      access   = "${lower(p.protocol)}://${aws_instance.this.public_ip}:${p.external}"
    }
  ]
}