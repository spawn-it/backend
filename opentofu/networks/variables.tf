# --- Network configuration ---

# Input variable defining the network to be created.
# Includes the provider type (e.g., "local" or "aws") and the desired Docker network name.
variable "instance" {
  description = "Configuration of the network to be created"
  type = object({
    provider     = string # Deployment provider (e.g., "local")
    network_name = string # Name of the Docker network to create
  })
}

# --- S3-compatible backend configuration ---

# Endpoint URL of the S3-compatible storage (e.g., http://localhost:9000 for MinIO)
variable "s3_endpoint" {
  description = "Endpoint for the S3-compatible storage"
  type        = string
}

# Access key for authenticating with the S3-compatible storage
# Marked as sensitive to hide it from CLI output
variable "s3_access_key" {
  description = "Access key for the S3-compatible storage"
  type        = string
  sensitive   = true
}

# Secret key for authenticating with the S3-compatible storage
# Marked as sensitive to prevent it from appearing in Terraform output
variable "s3_secret_key" {
  description = "Secret key for the S3-compatible storage"
  type        = string
  sensitive   = true
}
