import type { AppSyncResolverHandler } from 'aws-lambda';
import type {
  AuditBudgetInput,
  AuditBudgetMutationResult,
} from '@budget-audit/common';
import { buildAuditBudgetUseCase } from './composition-root';

interface AuditBudgetArgs {
  input: AuditBudgetInput;
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
  AuditBudgetArgs,
  AuditBudgetMutationResult
> = async (event) => {
  const useCase = buildAuditBudgetUseCase();
  const input = event.arguments.input;

  if (!input?.supplierId || !input?.s3Url) {
    throw new Error('supplierId y s3Url son requeridos.');
  }

  const result = await useCase.execute({
    supplierId: input.supplierId,
    s3Url: input.s3Url,
    contractId: input.contractId,
  });

  return result.budget;
};
