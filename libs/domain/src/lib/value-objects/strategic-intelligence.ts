/* =============================================================================
 * Strategic Intelligence — VO immutable que captura la inteligencia estratégica
 * del proveedor (riesgo, pagos, ESG, criticidad).
 *
 * Drives:
 *   - Sourcing decisions (renovar contrato vs cambiar de proveedor)
 *   - Workflows de pago temprano (early-pay discount)
 *   - Reportes ESG corporativos
 * ============================================================================= */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CriticalityIndex = 'LOW' | 'MEDIUM' | 'HIGH' | 'STRATEGIC';

export interface RiskProfileProps {
  /** 0..100, mayor = más sano. */
  score: number;
  level: RiskLevel;
  /** Date del último cálculo (truncado a día). */
  lastCheck: Date;
}

export class RiskProfile {
  private constructor(private readonly props: RiskProfileProps) {}

  static of(props: RiskProfileProps): RiskProfile {
    if (props.score < 0 || props.score > 100) {
      throw new Error(`RiskProfile.score fuera de rango 0..100: ${props.score}`);
    }
    return new RiskProfile(props);
  }

  get score(): number { return this.props.score; }
  get level(): RiskLevel { return this.props.level; }
  get lastCheck(): Date { return this.props.lastCheck; }
}

export interface PaymentStrategyProps {
  earlyPaymentPreferred: boolean;
  /** % objetivo de descuento si se paga antes (e.g. 2.0 = 2%). */
  discountTargetPercentage: number;
}

export class PaymentStrategy {
  private constructor(private readonly props: PaymentStrategyProps) {}

  static of(props: PaymentStrategyProps): PaymentStrategy {
    if (props.discountTargetPercentage < 0) {
      throw new Error('discountTargetPercentage no puede ser negativo.');
    }
    return new PaymentStrategy(props);
  }

  get earlyPaymentPreferred(): boolean {
    return this.props.earlyPaymentPreferred;
  }
  get discountTargetPercentage(): number {
    return this.props.discountTargetPercentage;
  }
}

export interface StrategicIntelligenceProps {
  riskProfile: RiskProfile;
  paymentStrategy: PaymentStrategy;
  /** Tags certificados (SUSTAINABLE_CERTIFIED, MINORITY_OWNED, ...). */
  diversityStatus: ReadonlyArray<string>;
  criticalityIndex: CriticalityIndex;
}

export class StrategicIntelligence {
  private constructor(private readonly props: StrategicIntelligenceProps) {}

  static of(props: StrategicIntelligenceProps): StrategicIntelligence {
    return new StrategicIntelligence(props);
  }

  get riskProfile(): RiskProfile { return this.props.riskProfile; }
  get paymentStrategy(): PaymentStrategy { return this.props.paymentStrategy; }
  get diversityStatus(): ReadonlyArray<string> { return this.props.diversityStatus; }
  get criticalityIndex(): CriticalityIndex { return this.props.criticalityIndex; }
}
