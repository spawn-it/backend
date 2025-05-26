variable "network" {
  description = "Configuration of the network to be created"
  type = object({
    provider     = string
    network_name = string
  })
}