import type { BudgetDto, DisputeEmailDto } from './budget.dto';

export interface AuditBudgetCommandDto {
  supplierId: string;
  s3Url: string;
  contractId?: string;
  /** S3 URLs adicionales para conciliación 3-way (OC + Factura, p.ej.). */
  poS3Url?: string;
  invoiceS3Url?: string;
  /** Datos del proyecto para proyectar cash flow. */
  projectDurationMonths?: number;
  elapsedMonths?: number;
}

export interface AuditBudgetResultDto {
  budget: BudgetDto;
}

export interface DraftDisputeCommandDto {
  supplierId: string;
  budgetId: string;
}

export interface DraftDisputeResultDto {
  email: DisputeEmailDto;
}
