import { AlertSeverity } from './alert-severity';

export const LegalRiskCategory = {
  PaymentTerms: 'PAYMENT_TERMS',
  Penalty: 'PENALTY',
  Liability: 'LIABILITY',
  Termination: 'TERMINATION',
  Confidentiality: 'CONFIDENTIALITY',
  SLA: 'SLA',
  PriceAdjustment: 'PRICE_ADJUSTMENT',
  Other: 'OTHER',
} as const;
export type LegalRiskCategory =
  (typeof LegalRiskCategory)[keyof typeof LegalRiskCategory];

/**
 * Riesgo identificado por el LLM en el texto libre del documento legal.
 * El severity se calcula combinando el score reportado por el modelo con
 * la categoría: cláusulas de penalidad o responsabilidad ilimitada son
 * automáticamente ROJAS aunque el score sea bajo.
 */
export interface LegalClauseRiskProps {
  clauseId: string;
  category: LegalRiskCategory;
  excerpt: string;
  rationale: string;
  /** 0..1 — score reportado por el modelo. */
  modelConfidence: number;
  /** 0..1 — qué tan severa es la cláusula (no la confianza). */
  riskScore: number;
  suggestion: string | null;
}

export class LegalClauseRisk {
  private constructor(private readonly props: LegalClauseRiskProps) {}

  static of(props: LegalClauseRiskProps): LegalClauseRisk {
    return new LegalClauseRisk(props);
  }

  get clauseId(): string { return this.props.clauseId; }
  get category(): LegalRiskCategory { return this.props.category; }
  get excerpt(): string { return this.props.excerpt; }
  get rationale(): string { return this.props.rationale; }
  get modelConfidence(): number { return this.props.modelConfidence; }
  get riskScore(): number { return this.props.riskScore; }
  get suggestion(): string | null { return this.props.suggestion; }

  get severity(): AlertSeverity {
    const isCriticalCategory =
      this.props.category === LegalRiskCategory.Penalty ||
      this.props.category === LegalRiskCategory.Liability;

    if (isCriticalCategory && this.props.riskScore >= 0.4) return AlertSeverity.Red;
    if (this.props.riskScore >= 0.7) return AlertSeverity.Red;
    if (this.props.riskScore >= 0.4) return AlertSeverity.Yellow;
    return AlertSeverity.Green;
  }
}
