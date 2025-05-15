variable "http_port" {
  type        = number
  description = "External port for the QuakeJS web interface."
}

variable "game_port" {
  type        = number
  default     = 27960
  description = "External UDP port for QuakeJS gameplay."
}

variable "game_slots" {
  type = number
  description = "Number of player slots (if supported by image)."
}

output "image" {
  value = "treyyoder/quakejs:latest"
}

output "env" {
  value = ["HTTP_PORT=${var.http_port}"]
}

output "ports" {
  value = [
    {
      internal = 80
      external = var.http_port
       protocol = "tcp"
    },
    {
      internal = 27960
      external = 27960
      protocol = "tcp"
    }
  ]
}

