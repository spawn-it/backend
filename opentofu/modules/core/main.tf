variable "provider_data" {
  type = object({
    instance_ip = string
  })
}

variable "game_data" {
  type = object({
    image  = string
    env    = list(string)
    ports  = list(object({
      internal = number
      external = number
    }))
  })
}

output "game_server_url" {
  value = "http://${var.provider_data.instance_ip}:${var.game_data.ports[0].external}"
}
