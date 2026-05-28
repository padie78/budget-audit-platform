import type { BudgetDto } from '@budget-audit/common';

export interface AuditBudgetCommand {
  tenantId: string;
  supplierId: string;
  s3Url: string;
  contractId?: string;
  /** Documentos adicionales para conciliación 3-way. */
  poS3Url?: string;
  invoiceS3Url?: string;
  /** Datos del proyecto para cash flow forecast. */
  projectDurationMonths?: number;
  elapsedMonths?: number;
}

export interface AuditBudgetResult {
  budget: BudgetDto;
}
