# --- Required Providers ---
terraform {
  required_providers {
    # MinIO provider to interact with S3-compatible object storage
    minio = {
      source  = "aminueza/minio"
      version = "3.5.2"
    }

    # Docker provider to manage local Docker resources
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.1"
    }

    # AWS provider to manage cloud infrastructure on Amazon Web Services
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# --- MinIO Provider ---
# Configures connection to an S3-compatible storage (e.g., self-hosted MinIO)
# Used for operations like uploading/downloading tfvars, configs, templates, etc.
provider "minio" {
  alias          = "s3"              # Optional alias if multiple MinIO endpoints are used
  minio_server   = var.s3_endpoint   # Endpoint URL of the MinIO/S3-compatible server
  minio_user     = var.s3_access_key # Access key for authentication
  minio_password = var.s3_secret_key # Secret key for authentication
}

# --- AWS Provider ---
# Default configuration for working with AWS resources (e.g., EC2, S3, etc.)
provider "aws" {
  region = var.aws_region # AWS region (e.g., Frankfurt)
}
