# Terraform Bootstrap

Crea los recursos que necesita el **backend remoto** de Terraform de la app
principal:

- Bucket S3 versionado y cifrado para `terraform.tfstate`.
- Tabla DynamoDB para locks (`LockID` como hash key).

Este sub-proyecto se ejecuta **una sola vez** con state **local** porque, por
definición, todavía no existe un bucket donde guardarlo remoto. Una vez creado,
el state local (`terraform/bootstrap/terraform.tfstate`) puede commitearse o no
— los recursos resultantes solo dependen de los nombres, y un `terraform import`
los recupera si hace falta.

## Uso

```bash
cd terraform/bootstrap

terraform init
terraform apply \
  -var "aws_account_id=473959757331" \
  -var "aws_region=eu-central-1"
```

Outputs útiles:

```bash
terraform output state_bucket
terraform output locks_table
```

Después, en `terraform/` (el módulo principal), `terraform init` se ejecuta así:

```bash
terraform init \
  -backend-config="bucket=$(terraform -chdir=../bootstrap output -raw state_bucket)" \
  -backend-config="key=prod/terraform.tfstate" \
  -backend-config="region=eu-central-1" \
  -backend-config="dynamodb_table=$(terraform -chdir=../bootstrap output -raw locks_table)"
```

Los workflows de GitHub Actions ya hacen este `init` con `-backend-config`
parametrizado (`vars.TF_STATE_BUCKET`, `vars.TF_STATE_LOCKS_TABLE`).
