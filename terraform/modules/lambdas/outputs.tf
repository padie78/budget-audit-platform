output "budget_processor_arn" {
  value = aws_lambda_function.budget_processor.arn
}
output "budget_processor_name" {
  value = aws_lambda_function.budget_processor.function_name
}

output "appsync_api_arn" {
  value = aws_lambda_function.appsync_api.arn
}
output "appsync_api_name" {
  value = aws_lambda_function.appsync_api.function_name
}

output "signer_arn" {
  value = aws_lambda_function.signer.arn
}
output "signer_name" {
  value = aws_lambda_function.signer.function_name
}
