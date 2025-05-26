module "provider_volume_local" {
  count          = var.volume.provider == "local" ? 1 : 0
  source         = "./modules/providers/local"
  volume_for     = var.volume.volume_for
}
