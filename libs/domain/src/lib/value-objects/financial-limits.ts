import { Money } from './money';

/* =============================================================================
 * Financial Limits — cupos presupuestarios del contrato (OPEX/CAPEX).
 * Inmutable; las actualizaciones de burn-rate generan un nuevo VO.
 * ============================================================================= */

export interface FinancialLimitsProps {
  totalBudgetLimit: Money;
  currentBurnRate: Money;
  allocatedOpexQuota: Money;
  allocatedCapexQuota: Money;
}

export class FinancialLimits {
  private constructor(private readonly props: FinancialLimitsProps) {}

  static of(props: FinancialLimitsProps): FinancialLimits {
    const currency = props.totalBudgetLimit.currency;
    const all = [
      props.currentBurnRate,
      props.allocatedOpexQuota,
      props.allocatedCapexQuota,
    ];
    for (const m of all) {
      if (m.currency !== currency) {
        throw new Error(
          `Monedas mixtas en FinancialLimits: ${m.currency} != ${currency}`,
        );
      }
    }
    return new FinancialLimits(props);
  }

  /** Restante = total - burn. Nunca devuelve negativo. */
  get remainingBudget(): Money {
    const total = this.props.totalBudgetLimit;
    const burnt = this.props.currentBurnRate;
    if (burnt.greaterThan(total)) return Money.zero(total.currency);
    return total.subtract(burnt);
  }

  /** % consumido (0..100). */
  get utilizationPercentage(): number {
    const total = this.props.totalBudgetLimit.amount;
    if (total === 0) return 0;
    return (this.props.currentBurnRate.amount / total) * 100;
  }

  get totalBudgetLimit(): Money { return this.props.totalBudgetLimit; }
  get currentBurnRate(): Money { return this.props.currentBurnRate; }
  get allocatedOpexQuota(): Money { return this.props.allocatedOpexQuota; }
  get allocatedCapexQuota(): Money { return this.props.allocatedCapexQuota; }
}
