output "appsync_endpoint" {
  value = module.api.graphql_endpoint
}

output "appsync_api_key" {
  value     = module.api.api_key
  sensitive = true
}

output "budgets_bucket" {
  value = module.storage.bucket_name
}

output "table_name" {
  value = module.database.table_name
}

output "frontend_bucket" {
  value = module.frontend_hosting.bucket_name
}

output "frontend_cloudfront_id" {
  value = module.frontend_hosting.distribution_id
}

output "frontend_url" {
  value = "https://${module.frontend_hosting.distribution_domain}"
}

output "budget_processor_lambda_name" {
  value = module.lambdas.budget_processor_name
}

output "appsync_api_lambda_name" {
  value = module.lambdas.appsync_api_name
}

output "signer_lambda_name" {
  value = module.lambdas.signer_name
}
