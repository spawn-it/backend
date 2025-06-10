variable "s3_endpoint" {
  description = "The endpoint of the S3 service"
  type = string
  default = "localhost:9000"
}

variable "s3_access_key" {
  description = "The access key for the S3 service"
  type = string
  sensitive   = true
}

variable "s3_secret_key" {
  description = "The secret key for the S3 service"
  type = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region where resources will be created"
  type = string
  default = "eu-central-1"
}

variable "aws_instance_type" {
  description = "AWS instance type for the container"
  type = string
  default = "t3.small"
}

variable "aws_key_name" {
  description = "AWS key pair name for SSH access to the instance"
  type = string
  default = "game-server-key"
}

# Main input variable defining the service instance to be deployed.
# This structure should align with the JSON templates and what the backend Node.js app constructs.
variable "instance" {
  description = "Container instance configurations"
  type = object({
    provider       = string                       # Target provider: "local" or "aws"
    container_name = string                       # Desired name for the container/service
    image          = string                       # Docker image to use
    ports          = map(string)                  # Port mappings: { "internal_container_port_str" = "external_host_port_str" }
    env_vars       = optional(map(string), {})    # Environment variables for the container
    command        = optional(list(string), [])   # Command to run in the container
    volume_mounts  = optional(list(object({       # Volume mounts
      host_path      = string                     # Path on the Docker host (for local) or EC2 instance (for AWS bind mounts)
      container_path = string                     # Path inside the container
    })), [])
    network_name   = string                       # Logical network name (used by local Docker, could map to VPC/subnet for AWS)
      aws_config = optional(object({              # AWS-specific configuration, provided if provider is "aws".
      region        = optional(string)            # Region for this specific EC2 instance
      instance_type = optional(string)            # EC2 instance type
      key_name      = optional(string, null)      # EC2 key pair name for SSH access
    }), null)                                     # Default to null if not an AWS deployment
  })
}
