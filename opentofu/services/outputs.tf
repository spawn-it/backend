output "instance_id" {
  description = "ID of the deployed instance/container."
  value = var.instance.provider == "aws" && length(module.provider_infra_aws) > 0 ? module.provider_infra_aws[0].instance_id : var.instance.provider == "local" && length(module.provider_infra_local) > 0 ? module.provider_infra_local[0].container_id : "N/A"
}

output "instance_public_ip_or_host" {
  description = "Public IP address (for cloud) or 'localhost' (for local)."
  value = var.instance.provider == "aws" && length(module.provider_infra_aws) > 0 ? module.provider_infra_aws[0].instance_public_ip : var.instance.provider == "local" ? "localhost" : "N/A"
}

output "primary_access_url" {
  description = "Primary access URL for the service."
  value = var.instance.provider == "aws" && length(module.provider_infra_aws) > 0 ? module.provider_infra_aws[0].game_url : var.instance.provider == "local" && length(module.provider_infra_local) > 0 ? module.provider_infra_local[0].primary_url : "N/A"
}

output "all_ports_info" {
  description = "Detailed information about all exposed ports."
  value = var.instance.provider == "aws" && length(module.provider_infra_aws) > 0 ? module.provider_infra_aws[0].all_ports_info : var.instance.provider == "local" && length(module.provider_infra_local) > 0 ? module.provider_infra_local[0].all_ports : []
}