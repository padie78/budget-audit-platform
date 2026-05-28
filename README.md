# Budget Audit Platform

Plataforma B2B de auditoría de presupuestos con IA. Sube un PDF de presupuesto de un proveedor, un LLM extrae los ítems en JSON estructurado, se comparan con el contrato base del proveedor y se generan alertas de desvío en tiempo real.

## Arquitectura

Monorepo Nx con Clean Architecture (Hexagonal) y AWS Serverless.

```
budget-audit-platform/
├── apps/budget-audit-web/        # Angular SPA (Split-View dashboard)
├── libs/
│   ├── common/                   # DTOs, contratos, key builders DynamoDB
│   ├── domain/                   # Entidades + Puertos (sin dependencias)
│   ├── application/              # Casos de uso
│   └── infrastructure/           # Adaptadores AWS / LLM
├── lambda_code/
│   ├── appsync_api_lambda/       # Resolver AppSync (queries/mutations)
│   ├── budget_processor_lambda/  # Orquesta extracción IA + auditoría
│   └── signer_lambda/            # Pre-signed URLs para upload de PDFs
└── terraform/                    # IaC modular (DynamoDB, S3, AppSync)
```

## Flujo

1. El usuario solicita una pre-signed URL al `signer_lambda` y sube el PDF a S3.
2. Lanza la mutation `auditBudget(s3Url, supplierId)` en AppSync.
3. `budget_processor_lambda` ejecuta el `AuditBudgetUseCase`:
   - Llama al `IAiExtractorService` (OpenAI/Bedrock con Structured Outputs).
   - Recupera el `Contract` línea base del proveedor desde DynamoDB.
   - Compara ítem por ítem y genera `BudgetAlert`s.
   - Persiste el `Budget` auditado.
4. Mediante la `subscription onAuditCompleted`, el frontend recibe el reporte en vivo.

## DynamoDB Single-Table Design

| Entidad | PK | SK |
|---|---|---|
| Supplier | `SUPPLIER#<id>` | `METADATA` |
| Contract base | `SUPPLIER#<id>` | `CONTRACT#<id>` |
| Budget auditado | `SUPPLIER#<id>` | `AUDIT#<id>` |

GSI1 (`GSI1PK=AUDIT_STATUS#<status>`, `GSI1SK=<createdAt>`) para listar auditorías por estado en orden temporal.

## Comandos

```bash
npm install
npm run start:web        # Angular dev server
npm run build            # Build libs + lambdas
cd terraform && terraform init && terraform apply
```
# budget-audit-platform
