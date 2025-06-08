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

resource "aws_security_group" "instance_sg" {
  name        = var.docker_instance_config.container_name
  description = "Allow traffic for ${var.docker_instance_config.container_name}"

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
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name           = var.docker_instance_config.container_name
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

  tags = {
    Name           = var.docker_instance_config.container_name
    SpawnItService = var.docker_instance_config.container_name
    Image          = var.docker_instance_config.image
  }
}
