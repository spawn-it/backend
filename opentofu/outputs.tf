output "game_server_public_ip" {
  description = "Public IP address of the game server instance."
  value       = module.provider_infra.instance_public_ip
}

output "game_server_primary_url" {
  description = "Primary URL for accessing the game server (e.g., web UI or connection string hint)."
  value       = module.provider_infra.game_url
}

output "game_server_instance_id" {
  description = "ID of the deployed cloud instance."
  value       = module.provider_infra.instance_id
}

output "game_server_all_ports" {
  description = "Detailed list of all configured ports and how to access them."
  value       = module.provider_infra.all_ports_info
}
