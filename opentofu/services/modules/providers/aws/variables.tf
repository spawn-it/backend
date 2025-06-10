variable "aws_config" {
  description = "AWS specific configurations like region, instance type, key name."
  type = object({
    region        = string                   # The AWS region where the EC2 instance will be created.
    instance_type = string                   # The type of EC2 instance (e.g., t3.small, m5.large).
    key_name      = optional(string, null)   # The name of an existing EC2 KeyPair for SSH access.
  })
}

variable "docker_instance_config" {
  description = "Configuration for the Docker container to run."
  type = object({
    container_name = string
    image          = string
    ports          = map(string)
    env_vars       = optional(map(string), {})
    command        = optional(list(string), [])
    volume_mounts  = optional(list(object({
      host_path      = string
      container_path = string
    })), [])
  })
}

variable "custom_user_data_script" {
  description = "A custom user_data script. If null, a generic Docker script is used."
  type        = string
  default     = null
}
