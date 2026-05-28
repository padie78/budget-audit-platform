import type { BudgetDto } from './budget.dto';

export interface AuditBudgetCommandDto {
  supplierId: string;
  s3Url: string;
  /** Opcional: si se conoce, fija el contrato a usar como referencia. */
  contractId?: string;
}

export interface AuditBudgetResultDto {
  budget: BudgetDto;
}
