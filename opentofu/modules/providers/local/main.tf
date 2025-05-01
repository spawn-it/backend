terraform {
  required_providers {
    docker = {
      source = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
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

resource "docker_image" "game" {
  name         = var.game_data.image
  keep_locally = true
}

resource "docker_container" "game" {
  name    = "game_server"
  image   = docker_image.game.image_id
  restart = "always"
  env     = var.game_data.env

  dynamic "ports" {
    for_each = var.game_data.ports
    content {
      internal = ports.value.internal
      external = ports.value.external
    }
  }
}

output "instance_ip" {
  value = "localhost"
}
