variable "s3_endpoint" {
  description = "The endpoint of the S3 service"
  type = string
  default = "localhost:9000"
}

variable "s3_access_key" {
  description = "The access key for the S3 service"
  type = string
}

variable "s3_secret_key" {
  description = "The secret key for the S3 service"
  type = string
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

variable "instance" {
  description = "Container instance configurations"
  type = object({
    provider       = string // "local" or "aws"
    container_name = string
    image          = string
    ports          = map(string) // { "internal" = "external" }
    env_vars       = optional(map(string), {})
    command        = optional(list(string), [])
    volume_mounts  = optional(list(object({
      host_path      = string
      container_path = string
    })), [])
    network_name   = string
      aws_config = optional(object({
      region        = string
      instance_type = string
      key_name      = optional(string, null)
    }), null)
  })
}
