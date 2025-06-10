// opentofu/services/modules/providers/aws/outputs.tf

output "instance_id" {
  description = "The ID of the created EC2 instance."
  value       = aws_instance.this.id
}

output "instance_public_ip" {
  description = "The public IP address of the EC2 instance."
  value       = aws_instance.this.public_ip
}

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
