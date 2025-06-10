output "instance_ip" {
  description = "IP address of the Docker container instance."
  value = docker_container.instance.network_data[0].ip_address
}

output "instance_id" {
  value = docker_container.instance.id
}

output "public_ip_or_host" {
  value = docker_container.instance.network_data[0].ip_address
}

output "ports_info" {
  value = [
    for port in docker_container.instance.ports : {
      external = port.external
      internal = port.internal
      protocol = port.protocol
    }
  ]
}