resource "aws_s3_bucket" "budgets" {
  bucket = "${var.name_prefix}-budgets-${data.aws_caller_identity.current.account_id}"
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_versioning" "budgets" {
  bucket = aws_s3_bucket.budgets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "budgets" {
  bucket = aws_s3_bucket.budgets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "budgets" {
  bucket                  = aws_s3_bucket.budgets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "budgets" {
  bucket = aws_s3_bucket.budgets.id

  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = ["*"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "budgets" {
  bucket = aws_s3_bucket.budgets.id

  rule {
    id     = "expire-uploads"
    status = "Enabled"

    filter {
      prefix = "uploads/"
    }

    expiration {
      days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
