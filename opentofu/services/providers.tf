terraform {
  required_providers {
    # MinIO provider for S3 backend state storage.
    minio = {
      source  = "aminueza/minio"
      version = "3.5.2"
    }
    # Docker provider for the 'local' deployment module.
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.1"
    }
    # AWS provider for the 'aws' deployment module.
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configuration for the MinIO provider, used for S3 backend.
provider "minio" {
  alias          = "s3"
  minio_server   = var.s3_endpoint
  minio_user     = var.s3_access_key
  minio_password = var.s3_secret_key
}

# Default AWS provider configuration for this 'services' root module.
provider "aws" {
  region = var.aws_region
}
