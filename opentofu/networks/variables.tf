# Input variable defining the network to be created.
variable "instance" {
  description = "Configuration of the network to be created"
  type = object({
    provider     = string
    network_name = string
  })
}

# S3 backend configuration variables.
variable "s3_endpoint" {
    description = "Endpoint for the S3-compatible storage"
    type        = string
}

variable "s3_access_key" {
    description = "Access key for the S3-compatible storage"
    type        = string
    sensitive   = true
}

variable "s3_secret_key" {
    description = "Secret key for the S3-compatible storage"
    type        = string
    sensitive   = true
}