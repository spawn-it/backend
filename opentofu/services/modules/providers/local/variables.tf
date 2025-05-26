variable "image" {
  description = "Docker image to use"
  type        = string
}

variable "container_name" {
  description = "Name of the Docker container"
  type        = string
}

variable "env_vars" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "command" {
  description = "Command to run in the container"
  type        = list(string)
  default     = []
}

variable "ports" {
  description = "Ports mapping (internal -> external)"
  type        = map(string)
  default     = {}
}

variable "volume_mounts" {
  description = "List of volume mounts for the container"
  type = list(object({
    host_path      = string
    container_path = string
  }))
  default = []
}


variable "network_name" {
  type        = string
  description = "The Docker network that must exist"
}