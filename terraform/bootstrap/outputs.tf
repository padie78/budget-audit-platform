output "state_bucket" {
  value       = aws_s3_bucket.state.bucket
  description = "Nombre del bucket S3 que aloja el state remoto."
}

output "state_bucket_arn" {
  value       = aws_s3_bucket.state.arn
  description = "ARN del bucket de state."
}

output "locks_table" {
  value       = aws_dynamodb_table.locks.name
  description = "Nombre de la tabla DynamoDB usada para state locking."
}

output "locks_table_arn" {
  value       = aws_dynamodb_table.locks.arn
  description = "ARN de la tabla DynamoDB de locks."
}
