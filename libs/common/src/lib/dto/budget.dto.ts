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
  legalText?: string;
}

export const AlertSeverity = {
  Green: 'GREEN',
  Yellow: 'YELLOW',
  Red: 'RED',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

export const AuditDecision = {
  Pending: 'PENDING',
  AutoApproved: 'AUTO_APPROVED',
  RequiresReview: 'REQUIRES_REVIEW',
  Rejected: 'REJECTED',
} as const;
export type AuditDecision = (typeof AuditDecision)[keyof typeof AuditDecision];

export interface PriceDiscrepancyDto {
  sku: string;
  description: string;
  quantity: number;
  agreedUnitPrice: number | null;
  quotedUnitPrice: number;
  deviationPercent: number;
  deviationPerUnit: number;
  projectedImpact: number;
  severity: AlertSeverity;
  message: string;
}

export interface LegalClauseRiskDto {
  clauseId: string;
  category: string;
  excerpt: string;
  rationale: string;
  modelConfidence: number;
  riskScore: number;
  severity: AlertSeverity;
  suggestion: string | null;
}

export type MatchStatus =
  | 'MATCHED'
  | 'PRICE_MISMATCH'
  | 'QUANTITY_MISMATCH'
  | 'MISSING_IN_PO'
  | 'MISSING_IN_INVOICE'
  | 'MISSING_IN_CONTRACT';

export interface ThreeWayMatchLineDto {
  sku: string;
  description: string;
  contractPrice: number | null;
  poPrice: number | null;
  invoicePrice: number | null;
  poQuantity: number | null;
  invoiceQuantity: number | null;
  status: MatchStatus;
  severity: AlertSeverity;
  notes: string;
}

export interface ThreeWayMatchResultDto {
  lines: ThreeWayMatchLineDto[];
  matchedCount: number;
  mismatchedCount: number;
  totalAuthorized: number;
  totalInvoiced: number;
  paymentExposure: number;
}

export interface CashFlowProjectionDto {
  monthlyOverrun: number;
  annualizedOverrun: number;
  projectedFinalOverrun: number;
  marginErosionPercent: number;
}

export interface DisputeEmailDto {
  to: string;
  cc: string[];
  subject: string;
  body: string;
  highlightedPoints: string[];
  attachmentUrl: string | null;
  draftedAt: string;
}

export interface BudgetDto {
  id: string;
  supplierId: string;
  contractId: string | null;
  s3Url: string;
  status: AuditStatus;
  decision: AuditDecision;
  extractedBudget: ExtractedBudgetDto | null;
  discrepancies: PriceDiscrepancyDto[];
  legalRisks: LegalClauseRiskDto[];
  threeWayMatch: ThreeWayMatchResultDto | null;
  cashFlowProjection: CashFlowProjectionDto | null;
  totalDeviationAmount: number;
  totalDeviationPercent: number;
  currency: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
