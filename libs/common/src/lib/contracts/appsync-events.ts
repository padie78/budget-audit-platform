import type { BudgetDto } from '../dto/budget.dto';

/**
 * Payloads de la API AppSync. Estos tipos viajan tanto en queries/mutations
 * como en las subscriptions, y son consumidos por el frontend.
 */

export interface AuditBudgetInput {
  tenantId: string;
  supplierId: string;
  s3Url: string;
  contractId?: string;
}

export type AuditBudgetMutationResult = BudgetDto;

export interface OnAuditCompletedEvent {
  budgetId: string;
  supplierId: string;
  budget: BudgetDto;
}

export const AppSyncOperationNames = {
  AuditBudgetMutation: 'auditBudget',
  OnAuditCompletedSubscription: 'onAuditCompleted',
  GetBudgetQuery: 'getBudget',
  ListBudgetsBySupplierQuery: 'listBudgetsBySupplier',
} as const;
