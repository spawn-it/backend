terraform {
  backend "s3" {}
}


module "network_create" {
  count = var.instance.provider == "local" ? 1 : 0
  source = "./modules/providers/local"
  network_name = var.instance.network_name
}