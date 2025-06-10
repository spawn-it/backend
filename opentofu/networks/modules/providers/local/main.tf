terraform {
  required_providers {
    # Docker provider is used to create and manage Docker resources.
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.1"
    }
  }
}

# Creates a Docker network with the given name.
resource "docker_network" "this" {
  name = var.network_name
}
