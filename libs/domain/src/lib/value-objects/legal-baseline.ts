/* =============================================================================
 * Legal Baseline — términos legales pactados del contrato.
 *
 * Se compara contra los `extracted_value` de cada auditoría para detectar
 * legal-clause-risks (pagos a 30 cuando se pactaron 45, jurisdicción alterada,
 * etc.).
 * ============================================================================= */

export interface LegalBaselineProps {
  paymentTermsDays: number;
  earlyPaymentDiscountPercentage: number;
  earlyPaymentWindowDays: number;
  jurisdiction: string;
  penaltyPerDelayDayPercentage: number;
  /** 0..1 — score normalizado de cumplimiento normativo. */
  governanceComplianceScore: number;
}

export class LegalBaseline {
  private constructor(private readonly props: LegalBaselineProps) {}

  static of(props: LegalBaselineProps): LegalBaseline {
    if (props.paymentTermsDays < 0) {
      throw new Error('paymentTermsDays no puede ser negativo.');
    }
    if (
      props.governanceComplianceScore < 0 ||
      props.governanceComplianceScore > 1
    ) {
      throw new Error('governanceComplianceScore fuera de rango 0..1.');
    }
    return new LegalBaseline(props);
  }

  get paymentTermsDays(): number { return this.props.paymentTermsDays; }
  get earlyPaymentDiscountPercentage(): number {
    return this.props.earlyPaymentDiscountPercentage;
  }
  get earlyPaymentWindowDays(): number {
    return this.props.earlyPaymentWindowDays;
  }
  get jurisdiction(): string { return this.props.jurisdiction; }
  get penaltyPerDelayDayPercentage(): number {
    return this.props.penaltyPerDelayDayPercentage;
  }
  get governanceComplianceScore(): number {
    return this.props.governanceComplianceScore;
  }
}
