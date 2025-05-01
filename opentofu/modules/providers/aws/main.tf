terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
    }
  }
}

variable "region" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "game_data" {
  type = object({
    image  = string
    env    = list(string)
    ports  = list(object({
      internal = number
      external = number
    }))
  })
}

locals {
  env_lines = join("\n", [
    for env in var.game_data.env : "  -e ${env} \\"
  ])

  port_lines = join("\n", [
    for p in var.game_data.ports : "  -p ${p.external}:${p.internal} \\"
  ])

  user_data = <<EOF
#!/bin/bash
apt update -y
apt install -y docker.io
systemctl start docker
docker run -d --restart always \\
${local.env_lines}
${local.port_lines}
${var.game_data.image}
EOF
}

resource "aws_instance" "game_server" {
  ami                         = "ami-0c1ac8a41498c1a9c" #ubuntu
  instance_type               = var.instance_type
  associate_public_ip_address = true
  user_data                   = local.user_data

  tags = {
    Name = "Game Server"
  }
}

output "instance_ip" {
  value = aws_instance.game_server.public_ip
}

output "game_url" {
  value = "http://${aws_instance.game_server.public_ip}:${var.game_data.ports[0].external}"
}
