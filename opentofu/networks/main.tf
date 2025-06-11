# --- Terraform backend configuration ---
# Remote state is stored in an S3 bucket.
# The actual bucket/key/configuration is expected to be provided externally (e.g., via CLI or environment variables).
terraform {
  backend "s3" {}
}

# --- Local Docker network creation ---

# This module creates a Docker network if the selected provider is "local"
# Ensures that local containers can communicate over a custom user-defined bridge network
module "network_create" {
  count        = var.instance.provider == "local" ? 1 : 0
  source       = "./modules/providers/local"

  # Name of the Docker network to create or use
  network_name = var.instance.network_name
}
