terraform {
  required_providers {
    # MinIO provider for S3 backend state storage.
    # This is used by the 'backend "s3" {}' block in main.tf.
    minio = {
      source  = "aminueza/minio"
      version = "3.5.2"
    }
  }
}

# Provider configuration for MinIO
provider "minio" {
  alias          = "s3"
  minio_server   = var.s3_endpoint
  minio_user     = var.s3_access_key
  minio_password = var.s3_secret_key
}