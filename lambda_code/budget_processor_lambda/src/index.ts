import type { AppSyncResolverHandler } from 'aws-lambda';
import type { AuditBudgetInput, BudgetDto } from '@budget-audit/common';
import { buildAuditBudgetUseCase, buildDraftDisputeUseCase } from './composition-root';

interface AuditBudgetArgs {
  input: AuditBudgetInput;
}

interface DraftDisputeArgs {
  input: { supplierId: string; budgetId: string };
}

/**
 * Handler de AppSync para la mutation `auditBudget`. Recibe directamente el
 * input desde el resolver (Direct Lambda Resolver), inicializa el caso de
 * uso y devuelve el `Budget` auditado.
 *
 * La invocación es síncrona desde AppSync; el caso de uso, antes de retornar,
 * ya publicó el evento que despierta a la subscription `onAuditCompleted`
 * para clientes que estén escuchando en vivo.
 */
export const handler: AppSyncResolverHandler<
  AuditBudgetArgs | DraftDisputeArgs,
  BudgetDto
> = async (event) => {
  const fieldName = event.info.fieldName;
  const input = (event.arguments as any).input;

  if (fieldName === 'auditBudget') {
    const useCase = buildAuditBudgetUseCase();
    if (!input?.supplierId || !input?.s3Url) {
      throw new Error('supplierId y s3Url son requeridos.');
    }

    const result = await useCase.execute({
      supplierId: input.supplierId,
      s3Url: input.s3Url,
      contractId: input.contractId,
      poS3Url: input.poS3Url,
      invoiceS3Url: input.invoiceS3Url,
      projectDurationMonths: input.projectDurationMonths,
      elapsedMonths: input.elapsedMonths,
    });

    return result.budget;
  }

  if (fieldName === 'draftDisputeEmail') {
    const useCase = buildDraftDisputeUseCase();
    if (!input?.supplierId || !input?.budgetId) {
      throw new Error('supplierId y budgetId son requeridos.');
    }
    const res = await useCase.execute({ supplierId: input.supplierId, budgetId: input.budgetId });
    // AppSync schema devolvería otro type; en MVP lo resolvemos en el schema en siguiente paso.
    return (res as any).email;
  }

  throw new Error(`Field no soportado: ${fieldName}`);
};
