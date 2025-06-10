output "instance_ip" {
  description = "IP address of the Docker container instance."
  value = docker_container.instance.network_data[0].ip_address
}

output "instance_id" {
  description = "The ID of the Docker container instance."
  value = docker_container.instance.id
}

output "instance_public_ip" {
  description = "For local Docker, access is via 'localhost' and mapped ports from the host."
  value = docker_container.instance.network_data[0].ip_address
}

output "ports_info" {
  description = "Information about all exposed ports for the local service."
  value = [
    for port in docker_container.instance.ports : {
      external = port.external
      internal = port.internal
      protocol = port.protocol
    }
  ]
}