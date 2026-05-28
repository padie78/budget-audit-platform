variable "project_name" {
  type    = string
  default = "budget-audit"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "openai_api_key" {
  type        = string
  sensitive   = true
  description = "API key del LLM (OpenAI). En producción usar Secrets Manager."
}
