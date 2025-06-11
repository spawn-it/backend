# Output the private IP address assigned to the Docker container on its network
output "instance_ip" {
  description = "IP address of the Docker container instance."
  value       = docker_container.instance.network_data[0].ip_address
}

# Output the unique container ID assigned by Docker
output "instance_id" {
  description = "The ID of the Docker container."
  value       = docker_container.instance.id
}

# Output the container's public-facing IP (same as private IP in most Docker setups)
# Can be useful for linking to exposed services from outside
output "instance_public_ip" {
  description = "Public IP address of the Docker container (usually same as internal IP)."
  value       = docker_container.instance.network_data[0].ip_address
}

# Output detailed information about each exposed port
# Includes external (host) port, internal (container) port, and protocol (e.g., tcp)
output "ports_info" {
  description = "Detailed information about all exposed ports on the container."
  value = [
    for port in docker_container.instance.ports : {
      external = port.external
      internal = port.internal
      protocol = port.protocol
    }
  ]
}