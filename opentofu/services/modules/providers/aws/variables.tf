# AWS-specific configuration used to provision the EC2 instance
variable "aws_config" {
  description = "AWS specific configurations like region, instance type, key name."
  type = object({
    # AWS region where the instance will be deployed (e.g., us-east-1)
    region = string

    # EC2 instance type to launch (e.g., t2.micro, t3a.small)
    instance_type = string

    # Optional SSH key pair name for EC2 access
    # If null, no key will be associated with the instance
    key_name = optional(string, null)
  })
}

# Configuration describing the Docker container to run on the EC2 instance
variable "docker_instance_config" {
  description = "Configuration for the Docker container to run."
  type = object({
    # Unique name of the Docker container
    container_name = string

    # Docker image to pull and run (e.g., nginx:latest)
    image = string

    # Port mappings from container port to external port (e.g., { "80" = "8080" })
    ports = map(string)

    # Optional environment variables to set inside the container
    # Defaults to an empty map
    env_vars = optional(map(string), {})

    # Optional command override for the container (entrypoint args)
    # Defaults to an empty list
    command = optional(list(string), [])

    # Optional volume mounts from host to container
    # Each object specifies a host path and its target path inside the container
    volume_mounts = optional(list(object({
      host_path      = string
      container_path = string
    })), [])
  })
}

# Optional custom user_data script to override the default one
# If null, the module will generate a Docker setup script automatically
variable "custom_user_data_script" {
  description = "A custom user_data script. If null, a generic Docker script is used."
  type        = string
}
