resource "aws_appsync_graphql_api" "this" {
  name                = "${var.name_prefix}-api"
  authentication_type = "API_KEY"
  schema              = file("${path.module}/schema.graphql")

  log_config {
    cloudwatch_logs_role_arn = aws_iam_role.appsync_logs.arn
    field_log_level          = "ERROR"
  }

  xray_enabled = true
}

resource "aws_appsync_api_key" "this" {
  api_id  = aws_appsync_graphql_api.this.id
  expires = timeadd(timestamp(), "8760h") # 1 año
  lifecycle {
    ignore_changes = [expires]
  }
}

# ─────────── IAM para que AppSync invoque las Lambdas ───────────
data "aws_iam_policy_document" "appsync_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["appsync.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "appsync_invoke" {
  name               = "${var.name_prefix}-appsync-invoke"
  assume_role_policy = data.aws_iam_policy_document.appsync_assume.json
}

data "aws_iam_policy_document" "appsync_invoke_policy" {
  statement {
    effect  = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [
      var.budget_processor_lambda_arn,
      var.appsync_api_lambda_arn,
      var.signer_lambda_arn,
    ]
  }
}

resource "aws_iam_role_policy" "appsync_invoke" {
  name   = "${var.name_prefix}-appsync-invoke"
  role   = aws_iam_role.appsync_invoke.id
  policy = data.aws_iam_policy_document.appsync_invoke_policy.json
}

resource "aws_iam_role" "appsync_logs" {
  name               = "${var.name_prefix}-appsync-logs"
  assume_role_policy = data.aws_iam_policy_document.appsync_assume.json
}

resource "aws_iam_role_policy_attachment" "appsync_logs" {
  role       = aws_iam_role.appsync_logs.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppSyncPushToCloudWatchLogs"
}

# ─────────── Data Sources ───────────
resource "aws_appsync_datasource" "budget_processor" {
  api_id           = aws_appsync_graphql_api.this.id
  name             = "budget_processor_lambda"
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.appsync_invoke.arn

  lambda_config {
    function_arn = var.budget_processor_lambda_arn
  }
}

resource "aws_appsync_datasource" "appsync_api" {
  api_id           = aws_appsync_graphql_api.this.id
  name             = "appsync_api_lambda"
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.appsync_invoke.arn

  lambda_config {
    function_arn = var.appsync_api_lambda_arn
  }
}

resource "aws_appsync_datasource" "signer" {
  api_id           = aws_appsync_graphql_api.this.id
  name             = "signer_lambda"
  type             = "AWS_LAMBDA"
  service_role_arn = aws_iam_role.appsync_invoke.arn

  lambda_config {
    function_arn = var.signer_lambda_arn
  }
}

resource "aws_appsync_datasource" "none" {
  api_id = aws_appsync_graphql_api.this.id
  name   = "none"
  type   = "NONE"
}

# ─────────── Resolvers (Direct Lambda) ───────────
locals {
  direct_lambda_request_template  = <<EOT
{
  "version": "2018-05-29",
  "operation": "Invoke",
  "payload": $util.toJson($context)
}
EOT
  direct_lambda_response_template = "$util.toJson($context.result)"

  passthrough_request_template  = <<EOT
{
  "version": "2017-02-28",
  "payload": $util.toJson($context.arguments)
}
EOT
  passthrough_response_template = "$util.toJson($context.arguments)"
}

resource "aws_appsync_resolver" "audit_budget" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "auditBudget"
  data_source       = aws_appsync_datasource.budget_processor.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "sign_upload" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "signUpload"
  data_source       = aws_appsync_datasource.signer.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "get_budget" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "getBudget"
  data_source       = aws_appsync_datasource.appsync_api.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "list_budgets_by_supplier" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "listBudgetsBySupplier"
  data_source       = aws_appsync_datasource.appsync_api.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "get_supplier" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "getSupplier"
  data_source       = aws_appsync_datasource.appsync_api.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

# ─────────── Portal de Proveedores (ABM) ───────────

resource "aws_appsync_resolver" "list_suppliers" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Query"
  field             = "listSuppliers"
  data_source       = aws_appsync_datasource.appsync_api.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "create_supplier" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "createSupplier"
  data_source       = aws_appsync_datasource.appsync_api.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "update_supplier" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "updateSupplier"
  data_source       = aws_appsync_datasource.appsync_api.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

resource "aws_appsync_resolver" "delete_supplier" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "deleteSupplier"
  data_source       = aws_appsync_datasource.appsync_api.name
  request_template  = local.direct_lambda_request_template
  response_template = local.direct_lambda_response_template
}

# Las mutations "publish*" son puramente pasivas (NONE datasource): solo
# disparan las subscriptions. Esto evita el round-trip a Lambda.
resource "aws_appsync_resolver" "publish_audit_completed" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "publishAuditCompleted"
  data_source       = aws_appsync_datasource.none.name
  request_template  = local.passthrough_request_template
  response_template = "$util.toJson($context.arguments.budget)"
}

resource "aws_appsync_resolver" "publish_audit_failed" {
  api_id            = aws_appsync_graphql_api.this.id
  type              = "Mutation"
  field             = "publishAuditFailed"
  data_source       = aws_appsync_datasource.none.name
  request_template  = local.passthrough_request_template
  response_template = "$util.toJson($context.arguments.budget)"
}
