import type { AuditStatus } from '../dynamodb/entity-types';

/* =============================================================================
 * BudgetDto — Auditoría transaccional (factura/OC vs contrato).
 *
 * Mantiene la nomenclatura `Budget` en el dominio (decisión de scope), pero el
 * shape interno alinea con el item `SK: AUDIT#<id>` del design (ver
 * dynamodb_design §2.3): tres bloques top-level (three_way_matching,
 * ai_analysis, analytics) que enriquecen el agregado.
 *
 * Los bloques extendidos son OPCIONALES para que el frontend legacy y los
 * fixtures existentes sigan deserializando sin migración.
 * ============================================================================= */

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

  // ─────────── Extensiones del design (financieros + fechas extra) ───────────
  invoiceNumber?: string;
  dueDate?: string;
  financialsNetAmount?: number;
  financialsTaxAmount?: number;
  financialsTotalSpend?: number;
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

  // ─────────── Resumen ejecutivo del 3-way matching (design §2.3) ───────────
  /** Status global (MATCHED / MISMATCH / PARTIAL). */
  status?: 'MATCHED' | 'MISMATCH' | 'PARTIAL';
  priceCheck?: 'PASSED' | 'FAILED' | 'WARN';
  quantityCheck?: 'PASSED' | 'FAILED' | 'WARN';
  poValidation?: 'PASSED' | 'FAILED' | 'WARN';
  matchTimestamp?: string;
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

/* ─────────── Bloques nuevos enriquecidos (`ai_analysis.*`) ─────────── */

/**
 * Resumen agregado del análisis de precio del LLM.
 * Complementa `discrepancies` (granular por SKU) con un único veredicto.
 */
export interface PriceDiscrepancySummaryDto {
  detectedOvercostUsd: number;
  deviationPercentage: number;
  severityLevel: AlertSeverity;
  /** Precio benchmark del mercado (median externo) si el LLM lo provee. */
  marketBenchmarkPrice: number | null;
}

export type DisputeWorkflowStatus =
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'APPROVED_TO_SEND'
  | 'SENT'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'DISMISSED';

export interface DisputeWorkflowHistoryEntryDto {
  timestamp: string;
  action: string;
  user: string;
  note?: string;
}

export interface DisputeWorkflowDto {
  status: DisputeWorkflowStatus;
  /** Pointer S3 al draft de email generado por el AI. */
  generatedEmailDraftS3: string | null;
  history: DisputeWorkflowHistoryEntryDto[];
  /** Departamento o usuario asignado. */
  assignedTo: string | null;
}

/** Bloque `ai_analysis` consolidado (precio + legal + workflow de disputa). */
export interface AiAnalysisDto {
  priceDiscrepancy?: PriceDiscrepancySummaryDto;
  legalClauseRisk?: LegalClauseRiskDto[];
  disputeWorkflow?: DisputeWorkflowDto;
}

/** Bloque `analytics` — métricas operacionales y ESG por auditoría. */
export interface AuditAnalyticsDto {
  maverickSpendFlag: boolean;
  earlyPaymentOpportunity: boolean;
  /** ISO timestamp del deadline para capturar el descuento. */
  earlyPaymentDiscountDeadline: string | null;
  potentialEarlyPaySavingsUsd: number;
  /** 0..1 — integridad de datos detectados (campos faltantes, OCR). */
  dataIntegrityScore: number;
  /** 0..1 — confianza global del LLM en la extracción. */
  llmConfidenceScore: number;
  /** Impacto Scope-3 de la transacción en kg de CO2 eq. */
  totalCo2eImpactKg: number;
}

export interface BudgetMetadataDto {
  s3RawPdfPointer?: string;
  processedByLambda?: string;
  /** ISO timestamp de procesado. */
  timestamp?: string;
  extractionVersion?: string;
}

export interface BudgetDto {
  tenantId: string;
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

  // ─────────── Extensiones del design ProcureTech OS (opcionales) ───────────
  documentType?: 'INVOICE' | 'PURCHASE_ORDER' | 'QUOTE' | 'CREDIT_NOTE';
  purchaseOrderReference?: string;
  /** Bloque AI consolidado (resumen ejecutivo del análisis). */
  aiAnalysis?: AiAnalysisDto;
  /** Métricas operacionales y ESG. */
  analytics?: AuditAnalyticsDto;
  metadata?: BudgetMetadataDto;
}
