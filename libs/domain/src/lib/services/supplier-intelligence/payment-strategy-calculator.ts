/* =============================================================================
 * PaymentStrategyCalculator — sugiere `strategic_intelligence.payment_strategy`.
 *
 * `discount_target_percentage`:
 *   target = COC * (days_saved / 365) + spread_strategic
 *   donde days_saved = net_days - early_days
 *   clamp(target, 0.5, 5.0)
 *
 * `early_payment_preferred`:
 *   true sii (avg_discount_offered_pct ≥ 1.0) AND
 *           cash position no STRESSED AND
 *           risk level ∈ {LOW, MEDIUM}
 * ============================================================================= */

import {
  PaymentStrategy,
  type RiskLevel,
} from '../../value-objects/strategic-intelligence';
import type { CfoContext } from './types';

export interface PaymentStrategyInputs {
  riskLevel: RiskLevel;
  cfo: CfoContext;
  /** Días promedio de pago netos del contrato (típico 30, 45, 60). */
  netDays: number;
  /** Días de pago temprano sugerido (típico 5-10). */
  earlyDays: number;
  /** % promedio histórico de descuento ofrecido por el proveedor. */
  avgHistoricalDiscountPct: number;
  /**
   * Spread estratégico extra al objetivo, % absoluto (e.g. 0.2 = 0.2%).
   * Proveedores estratégicos suelen tolerar más descuento.
   */
  strategicSpreadPct?: number;
}

export interface PaymentStrategyResult {
  earlyPaymentPreferred: boolean;
  discountTargetPercentage: number;
  paymentStrategy: PaymentStrategy;
}

const MIN_TARGET_PCT = 0.5;
const MAX_TARGET_PCT = 5.0;
const HISTORICAL_DISCOUNT_THRESHOLD = 1.0;

export class PaymentStrategyCalculator {
  static compute(input: PaymentStrategyInputs): PaymentStrategyResult {
    const daysSaved = Math.max(0, input.netDays - input.earlyDays);
    const coc = Math.max(0, input.cfo.costOfCapital);
    const spread = Math.max(0, input.strategicSpreadPct ?? 0);

    let target = coc * (daysSaved / 365) * 100 + spread;
    target = clamp(target, MIN_TARGET_PCT, MAX_TARGET_PCT);
    target = roundToHalf(target);

    const cashOk = input.cfo.cashPosition !== 'STRESSED';
    const riskOk = input.riskLevel === 'LOW' || input.riskLevel === 'MEDIUM';
    const discountOk = (input.avgHistoricalDiscountPct ?? 0) >= HISTORICAL_DISCOUNT_THRESHOLD;

    const earlyPaymentPreferred = cashOk && riskOk && discountOk;

    const paymentStrategy = PaymentStrategy.of({
      earlyPaymentPreferred,
      discountTargetPercentage: target,
    });

    return { earlyPaymentPreferred, discountTargetPercentage: target, paymentStrategy };
  }
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}
