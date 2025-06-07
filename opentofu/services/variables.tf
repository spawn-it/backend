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
