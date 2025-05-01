 # main.tf
module "provider" {
  source         = "./modules/providers/${var.deployment_target}"
  game_data      = module.game
  region         = var.region
  instance_type  = var.instance_type

  providers = {
    aws = aws.aws_main
  }
}


module "game" {
  source = "./modules/games/${var.game}"
  http_port = var.http_port
}

module "core" {
  source = "./modules/core"

  # Core needs to know the provider infrastructure and game container details
  provider_data = module.provider
  game_data     = module.game
}

provider "aws" {
  alias  = "aws_main"
  region = var.region
}
