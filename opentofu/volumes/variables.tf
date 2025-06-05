variable "instance" {
  description = "Volume configuration"
  type = object({
    provider    = string
    volume_for  = string
  })
}