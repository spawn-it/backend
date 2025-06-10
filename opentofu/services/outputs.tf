locals {
  active_module = var.instance.provider == "aws" ? try(module.provider_infra_aws[0], null) : try(module.provider_infra_local[0], null)
}

output "instance_id" {
  description = "ID of the deployed instance/container."
  value = try(local.active_module.instance_id, "N/A")
}

output "instance_public_ip_or_host" {
  description = "Public IP address (for cloud) or 'localhost' (for local)."
  value = try(local.active_module.public_ip_or_host, "N/A")
}

output "all_ports_info" {
  description = "Detailed information about all exposed ports."
  value = try(local.active_module.ports_info, [])
}