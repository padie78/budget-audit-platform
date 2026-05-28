import type {
  AlertSeverity,
  BudgetDto,
  PriceDiscrepancyDto,
} from '@budget-audit/common';

/**
 * View Models para la capa visual. Aíslan la forma de los DTOs del backend
 * de los componentes UI; si el contrato GraphQL cambia, solo se ajusta el
 * mapper.
 */
export type AuditWorkspaceState =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed';

export interface AuditResultRow {
  sku: string;
  description: string;
  quantity: number;
  agreedUnitPrice: number | null;
  quotedUnitPrice: number;
  deviationPercent: number;
  projectedImpact: number;
  severity: AlertSeverity;
  message: string;
}

export interface AuditSummaryVm {
  supplierName: string;
  currency: string;
  totalAmount: number;
  totalDeviationAmount: number;
  totalDeviationPercent: number;
  redAlertsCount: number;
  yellowAlertsCount: number;
  greenAlertsCount: number;
}

export const mapDiscrepancyToRow = (
  d: PriceDiscrepancyDto,
): AuditResultRow => ({
  sku: d.sku,
  description: d.description,
  quantity: d.quantity,
  agreedUnitPrice: d.agreedUnitPrice,
  quotedUnitPrice: d.quotedUnitPrice,
  deviationPercent: d.deviationPercent,
  projectedImpact: d.projectedImpact,
  severity: d.severity,
  message: d.message,
});

export const buildAuditSummary = (budget: BudgetDto): AuditSummaryVm => ({
  supplierName: budget.extractedBudget?.supplierName ?? budget.supplierId,
  currency: budget.extractedBudget?.currency ?? budget.currency ?? 'USD',
  totalAmount: budget.extractedBudget?.totalAmount ?? 0,
  totalDeviationAmount: budget.totalDeviationAmount,
  totalDeviationPercent: budget.totalDeviationPercent,
  redAlertsCount: budget.discrepancies.filter((d) => d.severity === 'RED').length,
  yellowAlertsCount: budget.discrepancies.filter((d) => d.severity === 'YELLOW').length,
  greenAlertsCount: budget.discrepancies.filter((d) => d.severity === 'GREEN').length,
});
