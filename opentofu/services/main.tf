terraform {
  backend "s3" {}
}

module "provider_infra_local" {
  count          = var.instance.provider == "local" ? 1 : 0
  source         = "./modules/providers/local"
  image          = var.instance.image
  container_name = var.instance.container_name
  env_vars       = var.instance.env_vars
  command        = var.instance.command
  ports          = var.instance.ports
  volume_mounts  = var.instance.volume_mounts
  network_name   = var.instance.network_name
}
