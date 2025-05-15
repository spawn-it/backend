 # main.tf
module "provider_infra" {
  source            = "./modules/providers/${var.deployment_target}"
  game_config       = module.game_specific_config # Pass the whole game config object
  region            = var.region
  instance_type     = var.instance_type
  key_name          = var.ssh_key_name # Pass the SSH key name

  # This 'providers' block is for passing alternate provider configurations
  # to modules, necessary if the module itself declares a provider block
  # (like modules/providers/aws/main.tf does)
  providers = {
    aws = aws.aws_main
    # gcp = google # if we add gcp support and the gcp module has a provider block
  }
}


module "game_specific_config" {
  source     = "./modules/games/${var.game}"
  http_port  = var.http_port
  game_port  = var.game_port # Added for quakejs example
  game_slots = var.game_slots
}

provider "aws" {
  alias  = "aws_main"
  region = var.region
}
