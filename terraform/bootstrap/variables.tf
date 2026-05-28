variable "aws_region" {
  type        = string
  default     = "eu-central-1"
  description = "Región donde se aloja el state remoto de Terraform."
}

variable "aws_account_id" {
  type        = string
  description = "Account ID de AWS. Forma parte del nombre del bucket para garantizar unicidad global."
}

variable "project_name" {
  type        = string
  default     = "budget-audit-platform"
  description = "Prefijo lógico del proyecto. Se usa para nombrar bucket y tabla."
}

variable "state_bucket_name_override" {
  type        = string
  default     = null
  description = "Si se define, fuerza el nombre del bucket; si no, se construye como <project_name>-tfstate-<account_id>."
}

variable "locks_table_name_override" {
  type        = string
  default     = null
  description = "Si se define, fuerza el nombre de la tabla DynamoDB de locks."
}
