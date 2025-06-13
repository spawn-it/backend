# Endpoint of the S3-compatible service (e.g., "localhost:9000" for MinIO)
# Should include host and port, without protocol (http/https is added by the provider)
variable "s3_endpoint" {
  description = "The endpoint of the S3 service"
  type        = string
  default     = "localhost:9000"
}

# Access key for the S3-compatible storage
# Acts like AWS_ACCESS_KEY_ID
variable "s3_access_key" {
  description = "The access key for the S3 service"
  type        = string
  sensitive   = true
}

# Secret key for the S3-compatible storage
# Acts like AWS_SECRET_ACCESS_KEY
variable "s3_secret_key" {
  description = "The secret key for the S3 service"
  type        = string
  sensitive   = true
}

# EC2 instance type to use for running the container (e.g., t3.micro, t3.small)
variable "aws_instance_type" {
  description = "AWS instance type for the container"
  type        = string
  default     = "t3.small"
}

# Name of the AWS key pair to associate with the EC2 instance for SSH access
# The key pair must already exist in the selected region
variable "aws_key_name" {
  description = "AWS key pair name for SSH access to the instance"
  type        = string
  default     = "game-server-key"
}

# AWS access key ID for authentication
variable "aws_access_key_id" {
  description = "AWS access key ID for authentication"
  type        = string
  sensitive = true
  default = null
}

# AWS secret access key for authentication
variable "aws_secret_access_key" {
  description = "AWS secret access key for authentication"
  type        = string
  sensitive = true
  default = null
}

# AWS region in which resources like EC2 instances will be deployed
variable "aws_default_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "eu-central-1" # Frankfurt
}

# Main input variable defining the service instance to be deployed.
# This structure should align with the JSON templates and what the backend Node.js app constructs.
variable "instance" {
  description = "Container instance configurations"
  type = object({
    provider       = string                     # Target provider: "local" or "aws"
    container_name = string                     # Desired name for the container/service
    image          = string                     # Docker image to use
    ports          = map(string)                # Port mappings: { "internal_container_port_str" = "external_host_port_str" }
    env_vars       = optional(map(string), {})  # Environment variables for the container
    command        = optional(list(string), []) # Command to run in the container
    volume_mounts = optional(list(object({      # Volume mounts
      host_path      = string                   # Path on the Docker host (for local) or EC2 instance (for AWS bind mounts)
      container_path = string                   # Path inside the container
    })), [])
    network_name = string                    # Logical network name (used by local Docker, could map to VPC/subnet for AWS)
    aws_config = optional(object({           # AWS-specific configuration, provided if provider is "aws".
      region        = optional(string)       # Region for this specific EC2 instance
      instance_type = optional(string)       # EC2 instance type
      key_name      = optional(string, null) # EC2 key pair name for SSH access
    }), null)                                # Default to null if not an AWS deployment
  })
}
