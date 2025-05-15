terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "region" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "game_config" {
  type = object({
    image    = string
    env      = list(string)
    ports    = list(object({
      internal = number
      external = number
      protocol = optional(string, "tcp") # Added protocol, defaults to tcp
    }))
  })
}

variable "key_name" {
  description = "Name of an existing EC2 KeyPair to enable SSH access to the instance."
  type        = string
  default     = null
}

# Find the latest Ubuntu 22.04 LTS AMI
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
  owners = ["099720109477"] # Canonical's AWS account ID
}

locals {
  user_data = <<-EOF
#!/bin/bash
set -e
echo "Starting user_data script"

echo "Updating package lists..."
apt-get update -y
echo "Installing Docker..."
apt-get install -y docker.io
echo "Starting and enabling Docker service..."
systemctl start docker
systemctl enable docker
echo "Ensuring Docker is active..."
systemctl is-active --quiet docker || (echo "Docker failed to start"; exit 1)

IMAGE_NAME="${var.game_config.image}"
echo "Docker image to use: $${IMAGE_NAME}"

echo "Pulling Docker image..."
docker pull "$${IMAGE_NAME}"

echo "Executing Docker run command:"
# Start the command
echo "docker run \\"
echo "  -d \\"
echo "  --restart always \\"

# Add environment variables if they exist
%{if length(var.game_config.env) > 0 ~}
%{for env_var in var.game_config.env ~}
echo "  -e \"${env_var}\" \\"
%{endfor ~}
%{endif ~}

# Add port mappings if they exist
%{if length(var.game_config.ports) > 0 ~}
%{for p in var.game_config.ports ~}
echo "  -p ${p.external}:${p.internal}${lower(p.protocol) == "udp" ? "/udp" : ""} \\"
%{endfor ~}
%{endif ~}

# Add log options
echo "  --log-driver json-file \\"
echo "  --log-opt max-size=10m \\"
echo "  --log-opt max-file=3 \\" # Last option always has a backslash before image

# Add the image name
echo "  \"$${IMAGE_NAME}\""

# Actual command execution
docker run \
  -d \
  --restart always \
%{if length(var.game_config.env) > 0 ~}
%{for env_var in var.game_config.env ~}
  -e "${env_var}" \
%{endfor ~}
%{endif ~}
%{if length(var.game_config.ports) > 0 ~}
%{for p in var.game_config.ports ~}
  -p ${p.external}:${p.internal}${lower(p.protocol) == "udp" ? "/udp" : ""} \
%{endfor ~}
%{endif ~}
  --log-driver json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  "$${IMAGE_NAME}"

echo "Docker run command finished. Check 'sudo docker ps -a'."
echo "User_data script completed."
EOF
}

resource "aws_security_group" "game_server_sg" {
  name        = "game-server-sg-${var.game_config.image}"
  description = "Allow game traffic for ${var.game_config.image}"

  # Ingress rules for game ports
  dynamic "ingress" {
    for_each = var.game_config.ports
    content {
      from_port   = ingress.value.external
      to_port     = ingress.value.external
      protocol    = ingress.value.protocol
      cidr_blocks = ["0.0.0.0/0"]
      description = "Game port ${ingress.value.external}/${ingress.value.protocol}"
    }
  }
  # Allow SSH for debugging (restrict CIDR block in production!)
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # WARNING: Open to the world. Restrict to your IP.
    description = "SSH access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1" # Allow all outbound traffic
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sg-${var.game_config.image}"
  }
}

resource "aws_instance" "game_server" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  associate_public_ip_address = true
  user_data                   = local.user_data
  key_name                    = var.key_name # Add key_name for SSH
  vpc_security_group_ids      = [aws_security_group.game_server_sg.id]

  tags = {
    Name = "Game Server - ${var.game_config.image}" # More descriptive name
    Game = var.game_config.image # Helps identify the game
  }
}

output "instance_id" {
  value = aws_instance.game_server.id
}

output "instance_public_ip" {
  value = aws_instance.game_server.public_ip
}

# Assuming the first port is the primary one for HTTP/URL access
output "game_url" {
  description = "Primary URL for the game server (usually web UI or main game port)"
  value       = var.game_config.ports[0].protocol == "udp" ? "${aws_instance.game_server.public_ip}:${var.game_config.ports[0].external}" : "http://${aws_instance.game_server.public_ip}:${var.game_config.ports[0].external}"
}

output "all_ports_info" {
  description = "Information about all exposed ports"
  value = [
    for p in var.game_config.ports : {
      external = p.external
      internal = p.internal
      protocol = p.protocol
      access   = "${p.protocol}://${aws_instance.game_server.public_ip}:${p.external}"
    }
  ]
}
