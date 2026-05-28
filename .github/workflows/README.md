# CI/CD — Budget Audit Platform

Cuatro workflows independientes, optimizados por `paths` para que solo se
ejecute lo que cambió en cada commit.

| Workflow | Trigger | Qué hace |
|---|---|---|
| `deploy-infra.yml` | push en `terraform/**` | `terraform fmt / validate / plan / apply` |
| `deploy-lambdas.yml` | push en `lambda_code/**` o libs backend | bundle esbuild + `aws lambda update-function-code` (matrix x3) |
| `deploy-frontend.yml` | push en `apps/budget-audit-web/**` o `libs/common/**` | `nx build --configuration=production` + `aws s3 sync` + invalidación CloudFront |
| `destroy-infra.yml` | manual (`workflow_dispatch`) | vacía buckets + `terraform destroy` |

## Configuración AWS (OIDC, sin credenciales estáticas)

1. Crea un **OIDC provider** en IAM apuntando a `https://token.actions.githubusercontent.com` (audience `sts.amazonaws.com`).
2. Crea un rol IAM (`budget-audit-deploy`) con trust policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
         "StringLike": { "token.actions.githubusercontent.com:sub": "repo:<ORG>/<REPO>:*" }
       }
     }]
   }
   ```

3. Adjunta políticas mínimas (Lambda, S3, CloudFront, DynamoDB, AppSync, IAM PassRole) o, para PoC, `PowerUserAccess`.

## Secrets & Variables a configurar en GitHub

En **Settings → Secrets and variables → Actions**:

### Repository secrets
- `AWS_DEPLOY_ROLE_ARN` — ARN del rol creado arriba.
- `OPENAI_API_KEY` — usado por `deploy-infra` y `destroy-infra` como `-var`.

### Repository variables
- `AWS_REGION` — ej. `eu-central-1` (default si no se define).

### Environment `production`
- Habilita "Required reviewers" para gate humano en deploys y destroys.

## Orden recomendado el primer día

```text
1. deploy-infra.yml      (crea DynamoDB, S3, AppSync, Lambdas vacías)
2. deploy-lambdas.yml    (sube el bundle real a las Lambdas)
3. deploy-frontend.yml   (compila Angular contra los outputs de Terraform)
```

A partir de allí, cada PR mergeado a `main` dispara solo el workflow que toca su carpeta.
