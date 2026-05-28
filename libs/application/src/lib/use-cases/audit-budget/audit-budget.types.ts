import type { BudgetDto } from '@budget-audit/common';

export interface AuditBudgetCommand {
  supplierId: string;
  s3Url: string;
  contractId?: string;
}

export interface AuditBudgetResult {
  budget: BudgetDto;
}
