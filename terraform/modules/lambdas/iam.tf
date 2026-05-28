data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${var.name_prefix}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "lambda_inline" {
  statement {
    sid    = "DynamoCrud"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:Query",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:DeleteItem",
    ]
    resources = [
      var.table_arn,
      "${var.table_arn}/index/*",
    ]
  }

  statement {
    sid    = "S3UploadRead"
    effect = "Allow"
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:HeadObject",
      "s3:DeleteObject",
    ]
    resources = ["${var.budgets_bucket_arn}/*"]
  }
}

resource "aws_iam_role_policy" "lambda_inline" {
  name   = "${var.name_prefix}-lambda-inline"
  role   = aws_iam_role.lambda_exec.id
  policy = data.aws_iam_policy_document.lambda_inline.json
}
