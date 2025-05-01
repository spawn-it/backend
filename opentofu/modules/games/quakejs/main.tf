variable "http_port" {
  type = number
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
    },
    {
      internal = 27960
      external = 27960
    }
  ]
}

