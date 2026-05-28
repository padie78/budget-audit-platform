provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "budget-audit-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
