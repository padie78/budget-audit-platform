variable "name_prefix" {
  type = string
}

variable "table_name" {
  type = string
}

variable "table_arn" {
  type = string
}

variable "budgets_bucket_name" {
  type = string
}

variable "budgets_bucket_arn" {
  type = string
}

variable "openai_api_key" {
  type      = string
  sensitive = true
}
