locals {
  use_local = var.instance.provider == "local"
  use_aws = var.instance.provider == "aws"
}