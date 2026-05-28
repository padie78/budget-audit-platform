locals {
  lambda_root = "${path.module}/../../../lambda_code"
}

data "archive_file" "budget_processor" {
  type        = "zip"
  source_dir  = "${local.lambda_root}/budget_processor_lambda/dist"
  output_path = "${path.module}/.artifacts/budget_processor.zip"
}

data "archive_file" "appsync_api" {
  type        = "zip"
  source_dir  = "${local.lambda_root}/appsync_api_lambda/dist"
  output_path = "${path.module}/.artifacts/appsync_api.zip"
}

data "archive_file" "signer" {
  type        = "zip"
  source_dir  = "${local.lambda_root}/signer_lambda/dist"
  output_path = "${path.module}/.artifacts/signer.zip"
}

resource "aws_lambda_function" "budget_processor" {
  function_name    = "${var.name_prefix}-budget-processor"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.budget_processor.output_path
  source_code_hash = data.archive_file.budget_processor.output_base64sha256
  timeout          = 60
  memory_size      = 1024

  environment {
    variables = {
      TABLE_NAME       = var.table_name
      BUDGETS_BUCKET   = var.budgets_bucket_name
      OPENAI_API_KEY   = var.openai_api_key
      APPSYNC_ENDPOINT = "https://placeholder-will-be-patched"
      LOG_LEVEL        = "INFO"
    }
  }
}

resource "aws_lambda_function" "appsync_api" {
  function_name    = "${var.name_prefix}-appsync-api"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.appsync_api.output_path
  source_code_hash = data.archive_file.appsync_api.output_base64sha256
  timeout          = 15
  memory_size      = 512

  environment {
    variables = {
      TABLE_NAME = var.table_name
    }
  }
}

resource "aws_lambda_function" "signer" {
  function_name    = "${var.name_prefix}-signer"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.signer.output_path
  source_code_hash = data.archive_file.signer.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      BUDGETS_BUCKET = var.budgets_bucket_name
    }
  }
}
