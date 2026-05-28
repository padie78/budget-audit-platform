import type {
  AlertSeverity,
  BudgetAlertDto,
  BudgetDto,
} from '@budget-audit/common';

/**
 * Tipos pensados para la capa visual: representan exactamente lo que los
 * componentes UI necesitan, sin acoplarse a la forma de DynamoDB ni a la
 * API GraphQL.
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
  agreedUnitPrice: number | null;
  quotedUnitPrice: number;
  deviationPercent: number;
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

export const mapAlertToRow = (alert: BudgetAlertDto): AuditResultRow => ({
  sku: alert.sku,
  description: alert.description,
  agreedUnitPrice: alert.agreedUnitPrice,
  quotedUnitPrice: alert.quotedUnitPrice,
  deviationPercent: alert.deviationPercent,
  severity: alert.severity,
  message: alert.message,
});

export const buildAuditSummary = (budget: BudgetDto): AuditSummaryVm => ({
  supplierName: budget.extractedBudget?.supplierName ?? budget.supplierId,
  currency: budget.extractedBudget?.currency ?? 'USD',
  totalAmount: budget.extractedBudget?.totalAmount ?? 0,
  totalDeviationAmount: budget.totalDeviationAmount,
  totalDeviationPercent: budget.totalDeviationPercent,
  redAlertsCount: budget.alerts.filter((a) => a.severity === 'RED').length,
  yellowAlertsCount: budget.alerts.filter((a) => a.severity === 'YELLOW').length,
  greenAlertsCount: budget.alerts.filter((a) => a.severity === 'GREEN').length,
});
