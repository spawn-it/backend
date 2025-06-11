locals {
  # Select the active module based on the instance's provider
  # If provider is "aws", reference the AWS module (index 0 if count = 1), otherwise use the local Docker module
  # Use `try` to avoid errors if the module is not present (count = 0)
  active_module = var.instance.provider == "aws" ? try(module.provider_infra_aws[0], null) : try(module.provider_infra_local[0], null)
}

# Output the unique ID of the created instance or container
# This comes from the active provider module (either AWS or local Docker)
output "instance_id" {
  description = "ID of the deployed instance/container."
  value       = try(local.active_module.instance_id, "N/A")
}

# Output the public IP address (for AWS) or "localhost" (for local deployments)
# Allows users to easily connect to the exposed service
output "instance_public_ip_or_host" {
  description = "Public IP address (for cloud) or 'localhost' (for local)."
  value       = try(local.active_module.instance_public_ip, "N/A")
}

# Output the full list of exposed ports with internal/external/protocol info
# Useful for building links, firewall rules, or health checks
output "all_ports_info" {
  description = "Detailed information about all exposed ports."
  value       = try(local.active_module.ports_info, [])
}
