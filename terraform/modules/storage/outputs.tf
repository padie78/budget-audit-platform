output "bucket_name" {
  value = aws_s3_bucket.budgets.bucket
}

output "bucket_arn" {
  value = aws_s3_bucket.budgets.arn
}
