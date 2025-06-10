# Module to create a local Docker volume if the provider is 'local'.
module "provider_volume_local" {
  count          = var.instance.provider == "local" ? 1 : 0
  source         = "./modules/providers/local"
  volume_for     = var.instance.volume_for
}
