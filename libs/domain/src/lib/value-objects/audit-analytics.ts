import { Money } from './money';

/* =============================================================================
 * Audit Analytics — métricas operacionales y ESG por auditoría individual.
 * Mapea con el bloque `analytics` del item AUDIT (design §2.3).
 * ============================================================================= */

export interface AuditAnalyticsProps {
  maverickSpendFlag: boolean;
  earlyPaymentOpportunity: boolean;
  earlyPaymentDiscountDeadline: Date | null;
  potentialEarlyPaySavings: Money;
  /** 0..1 — integridad de datos detectados. */
  dataIntegrityScore: number;
  /** 0..1 — confianza global del LLM en la extracción. */
  llmConfidenceScore: number;
  /** Impacto Scope-3 de la transacción en kg de CO2 eq. */
  totalCo2eImpactKg: number;
}

export class AuditAnalytics {
  private constructor(private readonly props: AuditAnalyticsProps) {}

  static of(props: AuditAnalyticsProps): AuditAnalytics {
    if (props.dataIntegrityScore < 0 || props.dataIntegrityScore > 1) {
      throw new Error('dataIntegrityScore fuera de rango 0..1.');
    }
    if (props.llmConfidenceScore < 0 || props.llmConfidenceScore > 1) {
      throw new Error('llmConfidenceScore fuera de rango 0..1.');
    }
    if (props.totalCo2eImpactKg < 0) {
      throw new Error('totalCo2eImpactKg no puede ser negativo.');
    }
    return new AuditAnalytics(props);
  }

  get maverickSpendFlag(): boolean { return this.props.maverickSpendFlag; }
  get earlyPaymentOpportunity(): boolean {
    return this.props.earlyPaymentOpportunity;
  }
  get earlyPaymentDiscountDeadline(): Date | null {
    return this.props.earlyPaymentDiscountDeadline;
  }
  get potentialEarlyPaySavings(): Money {
    return this.props.potentialEarlyPaySavings;
  }
  get dataIntegrityScore(): number { return this.props.dataIntegrityScore; }
  get llmConfidenceScore(): number { return this.props.llmConfidenceScore; }
  get totalCo2eImpactKg(): number { return this.props.totalCo2eImpactKg; }
}
