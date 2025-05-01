 # main.tf
module "provider" {
  source = "./modules/providers/${var.deployment_target}"
  game_data = module.game
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
