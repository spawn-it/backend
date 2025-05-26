variable "s3_endpoint" {
  type = string
}

variable "s3_access_key" {
  type = string
}

variable "s3_secret_key" {
  type = string
}

variable "instance" {
  description = "Container instance configurations"
  type = object({
    provider       = string
    container_name = string
    image          = string
    ports          = map(string)
    env_vars       = map(string)
    command        = list(string)
    volume_mounts  = optional(list(object({
      host_path      = string
      container_path = string
    })), [])
    network_name   = string
  })
}
