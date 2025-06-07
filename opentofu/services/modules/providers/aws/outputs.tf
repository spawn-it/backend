// opentofu/services/modules/providers/aws/outputs.tf

output "instance_id" {
  description = "The ID of the created EC2 instance."
  value       = aws_instance.this.id
}

output "instance_public_ip" {
  description = "The public IP address of the EC2 instance."
  value       = aws_instance.this.public_ip
}

output "game_url" { // Ou "primary_access_url" si tu préfères ce nom pour la sortie de ce module
  description = "Primary HTTP/TCP access URL for the service."
  value = local.actual_primary_port_info != null ? "http://${aws_instance.this.public_ip}:${local.actual_primary_port_info.external}" : (
    length(local.processed_ports) > 0 ? "${local.processed_ports[0].protocol}://${aws_instance.this.public_ip}:${local.processed_ports[0].external}"
    : "No port info to determine access URL"
  )
}

output "all_ports_info" {
  description = "Detailed information about all exposed ports for the service."
  value = [
    for p in local.processed_ports : {
      external = p.external
      internal = p.internal
      protocol = p.protocol
      access   = "${lower(p.protocol)}://${aws_instance.this.public_ip}:${p.external}"
    }
  ]
}
