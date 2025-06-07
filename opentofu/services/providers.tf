// backend/opentofu/services/providers.tf
terraform {
  required_providers {
    minio = { # Pour le backend S3
      source  = "aminueza/minio"
      version = "3.5.2"
    }
    docker = { # Pour le module providers/local
      source  = "kreuzwerker/docker"
      version = "~> 3.0.1"
    }
    aws = { # Pour le module providers/aws
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "minio" {
  alias          = "s3"
  minio_server   = var.s3_endpoint
  minio_user     = var.s3_access_key
  minio_password = var.s3_secret_key
}