# Terraform crea las funciones con un handler bootstrap mínimo. El código real
# se publica después desde `.github/workflows/deploy-lambdas.yml`, que compila
# cada Lambda y ejecuta `aws lambda update-function-code`.
data "archive_file" "bootstrap" {
  type        = "zip"
  output_path = "${path.module}/.artifacts/bootstrap.zip"

  source {
    filename = "index.js"
    content  = <<-EOT
      exports.handler = async () => ({
        statusCode: 503,
        body: JSON.stringify({
          message: "Lambda bootstrap deployed. Real code is published by deploy-lambdas workflow."
        })
      });
    EOT
  }
}

resource "aws_lambda_function" "budget_processor" {
  function_name    = "${var.name_prefix}-budget-processor"
  role             = aws_iam_role.lambda_exec.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
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
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
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
  filename         = data.archive_file.bootstrap.output_path
  source_code_hash = data.archive_file.bootstrap.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      BUDGETS_BUCKET = var.budgets_bucket_name
    }
  }
}
