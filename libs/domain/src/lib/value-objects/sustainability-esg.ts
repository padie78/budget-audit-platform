/* =============================================================================
 * Sustainability ESG — métricas Scope-3 del contrato (huella de carbono).
 * ============================================================================= */

export type EsgComplianceStatus = 'ON_TRACK' | 'AT_RISK' | 'BREACH';

export interface SustainabilityEsgProps {
  /** Cupo de CO2eq autorizado en el contrato (kg). */
  carbonBudgetCo2eKg: number;
  /** Consumo actual acumulado (kg de CO2eq). */
  currentUsageCo2eKg: number;
  complianceStatus: EsgComplianceStatus;
}

export class SustainabilityEsg {
  private constructor(private readonly props: SustainabilityEsgProps) {}

  static of(props: SustainabilityEsgProps): SustainabilityEsg {
    if (props.carbonBudgetCo2eKg < 0 || props.currentUsageCo2eKg < 0) {
      throw new Error('Valores negativos de carbono no son válidos.');
    }
    return new SustainabilityEsg(props);
  }

  get carbonBudgetCo2eKg(): number { return this.props.carbonBudgetCo2eKg; }
  get currentUsageCo2eKg(): number { return this.props.currentUsageCo2eKg; }
  get complianceStatus(): EsgComplianceStatus {
    return this.props.complianceStatus;
  }

  /** 0..100 — % consumido del cupo de carbono. */
  get utilizationPercentage(): number {
    if (this.props.carbonBudgetCo2eKg === 0) return 0;
    return (this.props.currentUsageCo2eKg / this.props.carbonBudgetCo2eKg) * 100;
  }
}
