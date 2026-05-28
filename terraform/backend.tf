# =============================================================================
# Remote backend — S3 + DynamoDB locking
#
# El backend es deliberadamente "parcial": los valores reales se inyectan vía
# `terraform init -backend-config=...`. Esto evita acoplar el state con un
# account-id concreto del repo y permite tener environments separados (dev,
# staging, prod) apuntando al mismo módulo Terraform con keys distintas.
#
# Bootstrap del bucket y la tabla de locks: ver `terraform/bootstrap/`. Hay que
# correrlo UNA SOLA VEZ con state local para crear esos recursos, antes de que
# este backend remoto pueda funcionar.
# =============================================================================
terraform {
  backend "s3" {
    encrypt = true
    # bucket, key, region y dynamodb_table se pasan con `-backend-config=`.
  }
}
