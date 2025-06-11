# Output the unique ID of the EC2 instance
output "instance_id" {
  description = "The ID of the created EC2 instance."
  value       = aws_instance.this.id
}

# Output the public IPv4 address assigned to the instance
output "instance_public_ip" {
  description = "The public IP address of the EC2 instance."
  value       = aws_instance.this.public_ip
}

# Output information about all ports exposed by the instance
# Each entry includes the external (host) port, internal (container) port, and protocol (e.g., tcp)
output "ports_info" {
  description = "Detailed information about all exposed ports for the service."
  value = [
    for p in local.processed_ports : {
      external = p.external
      internal = p.internal
      protocol = p.protocol
    }
  ]
}
