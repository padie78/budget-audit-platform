locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

module "database" {
  source      = "./modules/database"
  name_prefix = local.name_prefix
}

module "storage" {
  source      = "./modules/storage"
  name_prefix = local.name_prefix
}

module "lambdas" {
  source              = "./modules/lambdas"
  name_prefix         = local.name_prefix
  table_name          = module.database.table_name
  table_arn           = module.database.table_arn
  budgets_bucket_name = module.storage.bucket_name
  budgets_bucket_arn  = module.storage.bucket_arn
  openai_api_key      = var.openai_api_key
}

module "api" {
  source                       = "./modules/api"
  name_prefix                  = local.name_prefix
  budget_processor_lambda_arn  = module.lambdas.budget_processor_arn
  budget_processor_lambda_name = module.lambdas.budget_processor_name
  appsync_api_lambda_arn       = module.lambdas.appsync_api_arn
  appsync_api_lambda_name      = module.lambdas.appsync_api_name
  signer_lambda_arn            = module.lambdas.signer_arn
  signer_lambda_name           = module.lambdas.signer_name
}

module "frontend_hosting" {
  source      = "./modules/frontend_hosting"
  name_prefix = local.name_prefix
}
