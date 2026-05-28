import { Money } from '../value-objects/money';
import { AlertSeverity } from '../value-objects/alert-severity';
import { Contract } from './contract';
import { PriceDiscrepancy } from '../value-objects/price-discrepancy';
import { ThresholdPolicy } from '../value-objects/threshold-policy';
import { LegalClauseRisk } from '../value-objects/legal-clause-risk';
import type {
  ThreeWayMatchResult,
} from '../value-objects/three-way-match';
import {
  CashFlowProjection,
  type CashFlowProjectionInput,
} from '../value-objects/cash-flow-projection';
import {
  AiAnalysis,
  PriceDiscrepancySummary,
} from '../value-objects/ai-analysis';
import { DisputeWorkflow } from '../value-objects/dispute-workflow';
import { AuditAnalytics } from '../value-objects/audit-analytics';

/* =============================================================================
 * Budget — aggregate root de la auditoría transaccional (mapea con AUDIT#<id>
 * del DDB single-table design). Conserva el nombre `Budget` por consistencia
 * con el código existente.
 *
 * Bloques (todos opcionales excepto el core):
 *   • core            — id, supplierId, contractId, s3Url, status, decision
 *   • extractedBudget — datos extraídos del PDF por el LLM
 *   • discrepancies   — granularidad por SKU (legacy)
 *   • legalRisks      — granularidad por cláusula
 *   • threeWayMatch   — contract vs PO vs invoice
 *   • cashFlow        — proyecciones de tesorería del impacto
 *   • aiAnalysis      — resumen ejecutivo del AI (precio + legal + disputa)
 *   • analytics       — métricas operacionales y ESG por documento
 *   • metadata        — pointers S3, processor lambda, versión, etc.
 * ============================================================================= */

export const AuditStatus = {
  Pending: 'PENDING',
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
} as const;
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

export const AuditDecision = {
  Pending: 'PENDING',
  AutoApproved: 'AUTO_APPROVED',
  RequiresReview: 'REQUIRES_REVIEW',
  Rejected: 'REJECTED',
} as const;
export type AuditDecision = (typeof AuditDecision)[keyof typeof AuditDecision];

export type AuditDocumentType =
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'QUOTE'
  | 'CREDIT_NOTE';

export interface ExtractedBudgetItem {
  sku: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface ExtractedBudget {
  supplierName: string;
  quoteNumber: string | null;
  currency: string;
  issuedAt: Date | null;
  items: ExtractedBudgetItem[];
  totalAmount: Money;
  /** Texto libre de cláusulas legales si el doc lo contiene. */
  legalText?: string;

  // ─────────── Extensiones extraction (opcionales) ───────────
  invoiceNumber?: string;
  dueDate?: Date;
  financialsNetAmount?: Money;
  financialsTaxAmount?: Money;
  financialsTotalSpend?: Money;
}

export interface BudgetMetadata {
  s3RawPdfPointer?: string;
  processedByLambda?: string;
  timestamp?: Date;
  extractionVersion?: string;
}

export interface BudgetProps {
  id: string;
  supplierId: string;
  contractId: string | null;
  s3Url: string;
  status: AuditStatus;
  decision: AuditDecision;
  extractedBudget: ExtractedBudget | null;
  discrepancies: PriceDiscrepancy[];
  legalRisks: LegalClauseRisk[];
  threeWayMatch: ThreeWayMatchResult | null;
  cashFlowProjection: CashFlowProjection | null;
  totalDeviation: Money | null;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;

  // ─────────── Extensiones enterprise (opcionales) ───────────
  documentType?: AuditDocumentType;
  purchaseOrderReference?: string;
  aiAnalysis?: AiAnalysis;
  analytics?: AuditAnalytics;
  metadata?: BudgetMetadata;
}

export interface AuditAgainstParams {
  extracted: ExtractedBudget;
  contract: Contract | null;
  policy: ThresholdPolicy;
  legalRisks?: LegalClauseRisk[];
  threeWayMatch?: ThreeWayMatchResult | null;
  cashFlowInput?: Omit<CashFlowProjectionInput, 'totalDeviation'>;
  analytics?: AuditAnalytics;
}

/**
 * Aggregate root de la auditoría enterprise. Adicional a la comparación de
 * precios incluye:
 *   - Smart Thresholds (decisión automática Pending/AutoApproved/RequiresReview).
 *   - Legal compliance risks reportados por el LLM.
 *   - Three-Way Matching contra OC y Factura.
 *   - Cash Flow Forecast (monthly/annualized overrun, margin erosion).
 *   - AI Analysis consolidado (precio summary + legal + dispute workflow).
 *   - Operational analytics (maverick spend, early-pay, ESG impact).
 */
export class Budget {
  private constructor(private props: BudgetProps) {}

  static initialize(params: {
    id: string;
    supplierId: string;
    s3Url: string;
    contractId?: string | null;
    documentType?: AuditDocumentType;
    purchaseOrderReference?: string;
    createdAt?: Date;
  }): Budget {
    const now = params.createdAt ?? new Date();
    return new Budget({
      id: params.id,
      supplierId: params.supplierId,
      contractId: params.contractId ?? null,
      s3Url: params.s3Url,
      status: AuditStatus.Pending,
      decision: AuditDecision.Pending,
      extractedBudget: null,
      discrepancies: [],
      legalRisks: [],
      threeWayMatch: null,
      cashFlowProjection: null,
      totalDeviation: null,
      documentType: params.documentType,
      purchaseOrderReference: params.purchaseOrderReference,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: BudgetProps): Budget {
    return new Budget(props);
  }

  markAsProcessing(): void {
    this.props.status = AuditStatus.Processing;
    this.props.updatedAt = new Date();
  }

  markAsFailed(reason: string): void {
    this.props.status = AuditStatus.Failed;
    this.props.errorMessage = reason;
    this.props.updatedAt = new Date();
  }

  /**
   * Núcleo del agregado. Calcula discrepancias, severidades, three-way match,
   * cash flow y deja el estado en COMPLETED. También sintetiza el resumen
   * ejecutivo en `aiAnalysis.priceDiscrepancy` si hay un contrato base.
   */
  auditAgainst(params: AuditAgainstParams): void {
    this.props.extractedBudget = params.extracted;
    this.props.contractId = params.contract?.id ?? null;

    const currency = params.extracted.currency;
    const discrepancies: PriceDiscrepancy[] = [];
    let totalDeviation = Money.zero(currency);

    for (const item of params.extracted.items) {
      const agreed = params.contract?.findAgreedItem(item.sku);
      const discrepancy = PriceDiscrepancy.compute({
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        quotedUnitPrice: item.unitPrice,
        agreedUnitPrice: agreed?.agreedUnitPrice ?? null,
        policy: params.policy,
      });

      discrepancies.push(discrepancy);
      if (discrepancy.projectedImpact.amount > 0) {
        totalDeviation = totalDeviation.add(discrepancy.projectedImpact);
      }
    }

    this.props.discrepancies = discrepancies;
    this.props.totalDeviation = totalDeviation;
    this.props.legalRisks = params.legalRisks ?? [];
    this.props.threeWayMatch = params.threeWayMatch ?? null;

    if (params.cashFlowInput) {
      this.props.cashFlowProjection = CashFlowProjection.compute({
        totalDeviation,
        ...params.cashFlowInput,
      });
    }

    if (params.analytics) {
      this.props.analytics = params.analytics;
    }

    this.props.aiAnalysis = this.buildAiAnalysis(totalDeviation);
    this.props.decision = this.computeDecision(params.policy, totalDeviation);
    this.props.status = AuditStatus.Completed;
    this.props.updatedAt = new Date();
  }

  /**
   * Adjunta o actualiza el workflow de disputa. Idempotente sobre el VO
   * `DisputeWorkflow` (clonado), no muta los campos previos.
   */
  attachDisputeWorkflow(workflow: DisputeWorkflow): void {
    const current = this.props.aiAnalysis ?? AiAnalysis.empty();
    this.props.aiAnalysis = current.withDisputeWorkflow(workflow);
    this.props.updatedAt = new Date();
  }

  /**
   * Construye el bloque AI Analysis consolidado. Si hay discrepancias de
   * precio agrega el resumen ejecutivo (overcost, deviation, severidad), y
   * propaga los legal risks. El dispute workflow se preserva si ya existía.
   */
  private buildAiAnalysis(totalDeviation: Money): AiAnalysis {
    const extracted = this.props.extractedBudget;
    const baseTotal = extracted?.totalAmount.amount ?? 0;
    const previousWorkflow = this.props.aiAnalysis?.disputeWorkflow ?? null;

    let priceSummary: PriceDiscrepancySummary | null = null;
    if (
      this.props.discrepancies.length > 0 &&
      totalDeviation.amount > 0 &&
      baseTotal > 0
    ) {
      const maxSeverity = this.props.discrepancies.reduce<AlertSeverity>(
        (acc, d) => this.maxSeverity(acc, d.severity),
        AlertSeverity.Green,
      );

      priceSummary = PriceDiscrepancySummary.of({
        detectedOvercost: totalDeviation,
        deviationPercentage: (totalDeviation.amount / baseTotal) * 100,
        severityLevel: maxSeverity,
        marketBenchmarkPrice: null,
      });
    }

    return AiAnalysis.of({
      priceDiscrepancy: priceSummary,
      legalClauseRisks: this.props.legalRisks,
      disputeWorkflow: previousWorkflow,
    });
  }

  private maxSeverity(a: AlertSeverity, b: AlertSeverity): AlertSeverity {
    const rank: Record<AlertSeverity, number> = {
      [AlertSeverity.Green]: 0,
      [AlertSeverity.Yellow]: 1,
      [AlertSeverity.Red]: 2,
    };
    return rank[a] >= rank[b] ? a : b;
  }

  /**
   * Reglas de decisión (sin cambios respecto a la versión legacy):
   *  - Cualquier riesgo legal en ROJO → RequiresReview.
   *  - Three-way mismatch no trivial → RequiresReview.
   *  - Discrepancia roja por precio + no califica auto-approval → RequiresReview.
   *  - Caso contrario → AutoApproved.
   */
  private computeDecision(
    policy: ThresholdPolicy,
    totalDeviation: Money,
  ): AuditDecision {
    const hasCriticalLegal = this.props.legalRisks.some(
      (r) => r.severity === AlertSeverity.Red,
    );
    if (hasCriticalLegal) return AuditDecision.RequiresReview;

    const hasRedPrice = this.props.discrepancies.some(
      (d) => d.severity === AlertSeverity.Red,
    );
    if (hasRedPrice && !policy.qualifiesForAutoApproval(totalDeviation)) {
      return AuditDecision.RequiresReview;
    }

    const match = this.props.threeWayMatch;
    if (match && match.mismatchedCount > 0) return AuditDecision.RequiresReview;

    return AuditDecision.AutoApproved;
  }

  get id(): string { return this.props.id; }
  get supplierId(): string { return this.props.supplierId; }
  get contractId(): string | null { return this.props.contractId; }
  get s3Url(): string { return this.props.s3Url; }
  get status(): AuditStatus { return this.props.status; }
  get decision(): AuditDecision { return this.props.decision; }
  get extractedBudget(): ExtractedBudget | null { return this.props.extractedBudget; }
  get discrepancies(): readonly PriceDiscrepancy[] { return this.props.discrepancies; }
  get legalRisks(): readonly LegalClauseRisk[] { return this.props.legalRisks; }
  get threeWayMatch(): ThreeWayMatchResult | null { return this.props.threeWayMatch; }
  get cashFlowProjection(): CashFlowProjection | null { return this.props.cashFlowProjection; }
  get totalDeviation(): Money | null { return this.props.totalDeviation; }
  get errorMessage(): string | undefined { return this.props.errorMessage; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get documentType(): AuditDocumentType | undefined {
    return this.props.documentType;
  }
  get purchaseOrderReference(): string | undefined {
    return this.props.purchaseOrderReference;
  }
  get aiAnalysis(): AiAnalysis | undefined { return this.props.aiAnalysis; }
  get analytics(): AuditAnalytics | undefined { return this.props.analytics; }
  get metadata(): BudgetMetadata | undefined { return this.props.metadata; }

  get totalDeviationPercent(): number {
    if (!this.props.extractedBudget || !this.props.totalDeviation) return 0;
    const total = this.props.extractedBudget.totalAmount.amount;
    if (total === 0) return 0;
    return (this.props.totalDeviation.amount / total) * 100;
  }

  toSnapshot(): BudgetProps {
    return {
      ...this.props,
      discrepancies: [...this.props.discrepancies],
      legalRisks: [...this.props.legalRisks],
    };
  }
}
