import type { AuditStatus } from '../dynamodb/entity-types';

export interface ExtractedBudgetItemDto {
  sku: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ExtractedBudgetDto {
  supplierName: string;
  quoteNumber: string | null;
  currency: string;
  issuedAt: string | null;
  items: ExtractedBudgetItemDto[];
  totalAmount: number;
}

export const AlertSeverity = {
  Green: 'GREEN',
  Yellow: 'YELLOW',
  Red: 'RED',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export interface BudgetAlertDto {
  sku: string;
  description: string;
  agreedUnitPrice: number | null;
  quotedUnitPrice: number;
  /** Desvío porcentual respecto al precio pactado. Positivo = sobreprecio. */
  deviationPercent: number;
  severity: AlertSeverity;
  message: string;
}

export interface BudgetDto {
  id: string;
  supplierId: string;
  contractId: string | null;
  s3Url: string;
  status: AuditStatus;
  extractedBudget: ExtractedBudgetDto | null;
  alerts: BudgetAlertDto[];
  totalDeviationAmount: number;
  totalDeviationPercent: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
