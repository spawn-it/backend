terraform {
  # Backend configuration for storing the state of deployed services.
  backend "s3" {}
}

# Module for deploying services using the 'local' Docker provider.
# Instantiated if var.instance.provider is "local".
module "provider_infra_local" {
  count          = local.use_local ? 1 : 0
  source         = "./modules/providers/local"
  image          = var.instance.image
  container_name = var.instance.container_name
  env_vars       = var.instance.env_vars
  command        = var.instance.command
  ports          = var.instance.ports
  volume_mounts  = var.instance.volume_mounts
  network_name   = var.instance.network_name
}

# Module for deploying services using the AWS provider.
# Instantiated if var.instance.provider is "aws".
module "provider_infra_aws" {
  count  = local.use_aws ? 1 : 0
  source = "./modules/providers/aws"

  # Pass AWS-specific configuration (region, instance type, key name).
  aws_config = {
    region        = var.aws_default_region
    instance_type = var.aws_instance_type
    key_name      = var.aws_key_name
  }

  # Pass Docker container configuration details for the EC2 instance.
  docker_instance_config = {
    container_name = var.instance.container_name
    image          = var.instance.image
    ports          = var.instance.ports
    env_vars       = var.instance.env_vars
    command        = var.instance.command
    volume_mounts  = var.instance.volume_mounts
  }

  # Allows overriding the generic Docker user_data script if needed for specific AWS deployments.
  # Defaults to null, which means the generic script in the aws module will be used.
  custom_user_data_script = null
}
