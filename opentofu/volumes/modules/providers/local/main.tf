terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.1"
    }
  }
}

# Creates a named Docker volume.
resource "docker_volume" "this" {
  name = "volume-${var.volume_for}"
}
