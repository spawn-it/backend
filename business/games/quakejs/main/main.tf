terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

provider "docker" {}

variable "http_port" {
  description = "HTTP port to expose the QuakeJS server"
  type        = number
  default     = 8080
}

resource "docker_image" "quakejs" {
  name         = "treyyoder/quakejs:latest"
  keep_locally = true
}

resource "docker_container" "quakejs" {
  name    = "quakejs"
  image   = docker_image.quakejs.image_id
  restart = "always"

  env = [
    "HTTP_PORT=${var.http_port}"
  ]

  ports {
    external = var.http_port
    internal = 80
  }

  ports {
    external = 27960
    internal = 27960
  }
}

output "quakejs_address" {
  description = "URL for accessing the QuakeJS server"
  value       = "http://localhost:${var.http_port}"
}
