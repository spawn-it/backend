module "network_create" {
  count = var.network.provider == "local" ? 1 : 0
  source = "./modules/providers/local"
  network_name = var.network.network_name
}