# --- Required Providers Declaration ---
terraform {
  required_providers {
    # MinIO provider for managing S3-compatible object storage
    # Used for interacting with buckets and objects (e.g., upload/download configs)
    minio = {
      source  = "aminueza/minio"
      version = "3.5.2"
    }
  }
}

# --- MinIO Provider Configuration ---

# This provider connects to an S3-compatible MinIO server
# The alias "s3" allows distinguishing it from other potential MinIO instances
provider "minio" {
  alias          = "s3"              # Used when multiple MinIO providers may be declared
  minio_server   = var.s3_endpoint   # URL of the MinIO/S3-compatible endpoint (e.g., http://localhost:9000)
  minio_user     = var.s3_access_key # Access key (acts like AWS_ACCESS_KEY_ID)
  minio_password = var.s3_secret_key # Secret key (acts like AWS_SECRET_ACCESS_KEY)
}
