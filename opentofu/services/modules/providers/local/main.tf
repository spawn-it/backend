terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.2"
    }
  }
}

# Pull the Docker image specified by the 'image' variable
resource "docker_image" "instance" {
  name         = var.image
  keep_locally = false # Do not retain the image locally after container removal
}

# Look up an existing Docker network
data "docker_network" "custom_network" {
  name = var.network_name
}


# Create the Docker container
resource "docker_container" "instance" {
  name    = var.container_name
  image   = docker_image.instance.image_id
  env     = [for k, v in var.env_vars : "${k}=${v}"]
  command = var.command

  # Configure port mappings between host and container
  dynamic "ports" {
    for_each = var.ports # Expected format: { "container_port" = "host_port" }
    content {
      internal = tonumber(ports.key)
      external = tonumber(ports.value)
    }
  }

  # Mount the volume
  dynamic "volumes" {
    for_each = var.volume_mounts
    content {
      host_path      = volumes.value.host_path
      container_path = volumes.value.container_path
      read_only      = false
    }
  }


  # Attach container to the specified Docker network
  # Note: The network will not disappear if the container is removed
  networks_advanced {
    name = data.docker_network.custom_network.name
  }


  lifecycle {
    # Prevent unnecessary container recreation due to minor diffs
    #
    # Docker may return some attributes (like 'command', 'ports', 'network_mode')
    # with defaults or different formatting than the Terraform config.
    # The Docker provider compares these via 'docker inspect' and might trigger
    # recreation even if the behavior is unchanged.
    #
    # We ignore those fields to avoid unexpected restarts.
    # NOTE: Changes to these fields won't be applied unless 'ignore_changes' is removed
    # or you force recreation (e.g., using 'terraform taint').
    ignore_changes = [network_mode, ports, command]
  }

  restart = "unless-stopped"
}
