terraform {
  backend "s3" {}
}

// --- Provider LOCAL (Docker) ---
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

module "provider_infra_aws" {
  count  = var.instance.provider == "aws" ? 1 : 0
  source = "./modules/providers/aws"

  aws_config = var.instance.aws_config // C'est bien

  docker_instance_config = { // C'est bien aussi
    container_name = var.instance.container_name
    image          = var.instance.image
    ports          = var.instance.ports
    env_vars       = var.instance.env_vars
    command        = var.instance.command
    volume_mounts  = var.instance.volume_mounts
  }
  custom_user_data_script = null
}
