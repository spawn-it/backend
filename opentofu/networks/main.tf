terraform {
  # Backend configuration for storing the state of network resources.
  backend "s3" {}
}

# Module to create a Docker network if the provider is 'local'.
module "network_create" {
  count = var.instance.provider == "local" ? 1 : 0
  source = "./modules/providers/local"
  network_name = var.instance.network_name
}