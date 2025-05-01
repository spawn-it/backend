variable "region" {
  type = string
}

variable "instance_type" {
  type = string
}

provider "aws" {
  region = var.region
}

resource "aws_instance" "game_server" {
  ami                    = "ami-0c55b159cbfafe1f0" # Ubuntu 22.04 (adjust as needed)
  instance_type          = var.instance_type
  associate_public_ip_address = true
  # You can attach a security group, user_data to install Docker, etc.
}

output "instance_ip" {
  value = aws_instance.game_server.public_ip
}

