# It requires the AWS provider. Each module should declare its provider requirements.
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source to find the latest Ubuntu 22.04 LTS AMI for amd64.
# This ensures the EC2 instance uses a recent and common Linux distribution.
data "aws_ami" "ubuntu" {
  most_recent = true        # Selects the newest AMI matching the filters.
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]        # Hardware Virtual Machine
  }
  owners = ["099720109477"] # Canonical's official AWS account ID for Ubuntu images.
}

# AWS Security Group to control network traffic to and from the EC2 instance.
resource "aws_security_group" "instance_sg" {
  name        = var.docker_instance_config.container_name
  description = "Allow traffic for ${var.docker_instance_config.container_name}"

  # Dynamically create ingress rules for each port defined in `local.processed_ports`.
  dynamic "ingress" {
    for_each = local.processed_ports
    content {
      from_port   = ingress.value.external  # Start of the port range (same as to_port for single ports).
      to_port     = ingress.value.external  # End of the port range.
      protocol    = ingress.value.protocol  # Protocol (e.g., "tcp", "udp").
      cidr_blocks = ["0.0.0.0/0"]           # Allows traffic from any IP address
      description = "Port ${ingress.value.external}/${ingress.value.protocol} for ${var.docker_instance_config.container_name}"
    }
  }

  # Standard ingress rule to allow SSH access (port 22/tcp) from any IP.
  # WARNING: For production, restrict cidr_blocks to specific IPs or a bastion host.
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access"
  }

  # Standard egress rule to allow all outbound traffic from the instance.
  egress {
    from_port   = 0             # Any source port.
    to_port     = 0             # Any destination port.
    protocol    = "-1"          # Any protocol.
    cidr_blocks = ["0.0.0.0/0"] # To any destination IP.
  }

  tags = {
    Name           = var.docker_instance_config.container_name  # Tag the SG with the container name.
    SpawnItService = var.docker_instance_config.container_name  # Custom tag for identifying SpawnIt services.
  }
}

# AWS EC2 instance resource.
resource "aws_instance" "this" {
  ami                         = data.aws_ami.ubuntu.id              # AMI ID from the data source.
  instance_type               = var.aws_config.instance_type        # EC2 instance type (e.g., t3.small).
  associate_public_ip_address = true                                # Assign a public IP address to the instance.
  user_data                   = local.final_user_data               # Cloud-init script for instance setup (Docker, container run).
  key_name                    = var.aws_config.key_name             # Name of the EC2 KeyPair for SSH access.
  vpc_security_group_ids      = [aws_security_group.instance_sg.id] # Associate with the created Security Group.

  tags = {
    Name           = var.docker_instance_config.container_name      # Tag the instance.
    SpawnItService = var.docker_instance_config.container_name      # Custom tag.
    Image          = var.docker_instance_config.image               # Tag with the Docker image being run.
  }
}
