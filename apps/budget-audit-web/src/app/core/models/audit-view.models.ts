import type {
  AlertSeverity,
  AuditAnalyticsDto,
  AuditDecision,
  BudgetDto,
  DisputeWorkflowDto,
  LegalClauseRiskDto,
  PriceDiscrepancyDto,
} from '@budget-audit/common';

/* =============================================================================
 * View Models — adaptan los DTOs del backend a estructuras planas que las
 * vistas consumen sin lógica. Aislan el contrato GraphQL: si el shape cambia,
 * solo se ajustan los mappers de abajo.
 * ============================================================================= */

export type AuditWorkspaceState =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed';

/* ─────────── Tabla de discrepancias (existente) ─────────── */

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

/* ─────────── Resumen ejecutivo (existente + nuevas métricas) ─────────── */

export interface AuditSummaryVm {
  supplierName: string;
  currency: string;
  totalAmount: number;
  totalDeviationAmount: number;
  totalDeviationPercent: number;
  redAlertsCount: number;
  yellowAlertsCount: number;
  greenAlertsCount: number;

  // ─────────── Extensiones enterprise (opcionales) ───────────
  decision: AuditDecision;
  /** Veredicto agregado del LLM (severidad global). */
  aiSeverity?: AlertSeverity;
  /** Sobrecosto agregado del análisis del LLM (USD). */
  aiOvercost?: number;
  /** Workflow de disputa activo. */
  disputeStatus?: DisputeWorkflowDto['status'];
  /** ¿Hay oportunidad de descuento por pago temprano? */
  hasEarlyPaymentOpportunity?: boolean;
  /** Ahorro estimado por pago temprano. */
  potentialEarlyPaySavings?: number;
  /** 0..1, confianza global del LLM en la extracción. */
  llmConfidenceScore?: number;
  /** Impacto Scope-3 (kg CO2eq). */
  totalCo2eImpactKg?: number;
}

export const buildAuditSummary = (budget: BudgetDto): AuditSummaryVm => {
  const ai = budget.aiAnalysis;
  const analytics = budget.analytics;

  return {
    supplierName: budget.extractedBudget?.supplierName ?? budget.supplierId,
    currency: budget.extractedBudget?.currency ?? budget.currency ?? 'USD',
    totalAmount: budget.extractedBudget?.totalAmount ?? 0,
    totalDeviationAmount: budget.totalDeviationAmount,
    totalDeviationPercent: budget.totalDeviationPercent,
    redAlertsCount: budget.discrepancies.filter((d) => d.severity === 'RED').length,
    yellowAlertsCount: budget.discrepancies.filter((d) => d.severity === 'YELLOW')
      .length,
    greenAlertsCount: budget.discrepancies.filter((d) => d.severity === 'GREEN')
      .length,

    decision: budget.decision,
    aiSeverity: ai?.priceDiscrepancy?.severityLevel,
    aiOvercost: ai?.priceDiscrepancy?.detectedOvercostUsd,
    disputeStatus: ai?.disputeWorkflow?.status,
    hasEarlyPaymentOpportunity: analytics?.earlyPaymentOpportunity,
    potentialEarlyPaySavings: analytics?.potentialEarlyPaySavingsUsd,
    llmConfidenceScore: analytics?.llmConfidenceScore,
    totalCo2eImpactKg: analytics?.totalCo2eImpactKg,
  };
};

/* ─────────── Riesgos legales (nuevo) ─────────── */

export interface LegalRiskRow {
  clauseId: string;
  category: string;
  excerpt: string;
  rationale: string;
  severity: AlertSeverity;
  riskScore: number;
  modelConfidence: number;
  suggestion: string | null;
}

export const mapLegalRiskToRow = (r: LegalClauseRiskDto): LegalRiskRow => ({
  clauseId: r.clauseId,
  category: r.category,
  excerpt: r.excerpt,
  rationale: r.rationale,
  severity: r.severity,
  riskScore: r.riskScore,
  modelConfidence: r.modelConfidence,
  suggestion: r.suggestion,
});

export const extractLegalRiskRows = (
  budget: BudgetDto | null,
): readonly LegalRiskRow[] => {
  if (!budget) return [];
  const source =
    budget.aiAnalysis?.legalClauseRisk?.length
      ? budget.aiAnalysis.legalClauseRisk
      : budget.legalRisks;
  return source.map(mapLegalRiskToRow);
};

/* ─────────── Workflow de disputa (nuevo) ─────────── */

export interface DisputeWorkflowVm {
  status: DisputeWorkflowDto['status'];
  assignedTo: string | null;
  hasDraft: boolean;
  draftUrl: string | null;
  lastUpdate: string | null;
  historyCount: number;
}

export const buildDisputeWorkflowVm = (
  budget: BudgetDto | null,
): DisputeWorkflowVm | null => {
  const w = budget?.aiAnalysis?.disputeWorkflow;
  if (!w) return null;
  const lastEntry = w.history.at(-1);
  return {
    status: w.status,
    assignedTo: w.assignedTo,
    hasDraft: !!w.generatedEmailDraftS3,
    draftUrl: w.generatedEmailDraftS3,
    lastUpdate: lastEntry?.timestamp ?? null,
    historyCount: w.history.length,
  };
};

/* ─────────── Analytics widget (nuevo) ─────────── */

export type AnalyticsWidgetVm = AuditAnalyticsDto;

export const extractAnalytics = (
  budget: BudgetDto | null,
): AnalyticsWidgetVm | null => budget?.analytics ?? null;
