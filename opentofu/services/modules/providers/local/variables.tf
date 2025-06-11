# Docker image to use for the container (e.g., nginx:latest, postgres:15)
variable "image" {
  description = "Docker image to use"
  type        = string
}

# Name to assign to the Docker container (must be unique within the Docker host)
variable "container_name" {
  description = "Name of the Docker container"
  type        = string
}

# Key-value map of environment variables to inject into the container
# Example: { "ENV" = "production", "PORT" = "8080" }
# Optional: defaults to an empty map
variable "env_vars" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

# Optional list of arguments to override the default container command (entrypoint)
# Example: ["npm", "run", "start"]
variable "command" {
  description = "Command to run in the container"
  type        = list(string)
  default     = []
}

# Map of container port to host port bindings
# Format: { "80" = "8080", "443" = "8443" }
# Optional: defaults to no exposed ports
variable "ports" {
  description = "Ports mapping (internal -> external)"
  type        = map(string)
  default     = {}
}

# Optional list of volume mounts between host and container
# Each mount must specify a host path and corresponding container path
# Example: [{ host_path = "/data", container_path = "/app/data" }]
variable "volume_mounts" {
  description = "List of volume mounts for the container"
  type = list(object({
    host_path      = string
    container_path = string
  }))
  default = []
}

# Name of the Docker network to attach the container to
# The network must already exist before running this module
variable "network_name" {
  type        = string
  description = "The Docker network that must exist"
}