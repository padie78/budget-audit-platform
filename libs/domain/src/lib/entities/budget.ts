import { Money } from '../value-objects/money';
import { AlertSeverity } from '../value-objects/alert-severity';
import { Contract } from './contract';
import {
  PriceDiscrepancy,
} from '../value-objects/price-discrepancy';
import { ThresholdPolicy } from '../value-objects/threshold-policy';
import { LegalClauseRisk } from '../value-objects/legal-clause-risk';
import type {
  ThreeWayMatchResult,
} from '../value-objects/three-way-match';
import {
  CashFlowProjection,
  type CashFlowProjectionInput,
} from '../value-objects/cash-flow-projection';

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
}

export interface AuditAgainstParams {
  extracted: ExtractedBudget;
  contract: Contract | null;
  policy: ThresholdPolicy;
  legalRisks?: LegalClauseRisk[];
  threeWayMatch?: ThreeWayMatchResult | null;
  cashFlowInput?: Omit<CashFlowProjectionInput, 'totalDeviation'>;
}

/**
 * Aggregate root de la auditoría enterprise. Adicional a la comparación de
 * precios incluye:
 *   - Smart Thresholds (decisión automática Pending/AutoApproved/RequiresReview).
 *   - Legal compliance risks reportados por el LLM.
 *   - Three-Way Matching contra OC y Factura.
 *   - Cash Flow Forecast (monthly/annualized overrun, margin erosion).
 */
export class Budget {
  private constructor(private props: BudgetProps) {}

  static initialize(params: {
    id: string;
    supplierId: string;
    s3Url: string;
    contractId?: string | null;
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
   * Núcleo del agregado. Recibe el extracto del LLM, el contrato, la
   * política de umbrales y opcionalmente el three-way match + base para
   * proyectar cash flow. Calcula todo y deja el estado en COMPLETED.
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

    this.props.decision = this.computeDecision(params.policy, totalDeviation);
    this.props.status = AuditStatus.Completed;
    this.props.updatedAt = new Date();
  }

  /**
   * Reglas:
   *  - Si hay cualquier riesgo legal en ROJO → RequiresReview.
   *  - Si el three-way match reporta mismatches no triviales → RequiresReview.
   *  - Si todo está dentro de la política (incluye auto-approval limit) →
   *    AutoApproved (luz amarilla "ok para CFO").
   *  - Si hay discrepancia roja por precio → RequiresReview.
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
