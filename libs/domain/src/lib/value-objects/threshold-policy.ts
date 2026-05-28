import { Money } from './money';

/**
 * Smart Thresholds — política de tolerancia configurable por proveedor.
 *
 * Reglas combinables:
 *   - `percentTolerance`: porcentaje permitido por encima del precio pactado.
 *   - `absoluteTolerance`: monto absoluto permitido por línea.
 *   - `autoApprovalUpTo`: si el desvío total se mantiene bajo este umbral, la
 *     auditoría queda "pre-aprobada autónomamente" (estado AMARILLO en lugar
 *     de ROJO) y se desbloquea el workflow downstream sin intervención humana.
 *
 * Un desvío puntual entra en VERDE cuando NO supera el contrato. Pasa a
 * AMARILLO si está dentro de alguna tolerancia. Pasa a ROJO si rompe ambas.
 */
export class ThresholdPolicy {
  private constructor(
    private readonly percentTolerance: number,
    private readonly absoluteTolerance: Money | null,
    private readonly autoApprovalUpTo: Money | null,
  ) {}

  static default(currency: string): ThresholdPolicy {
    return new ThresholdPolicy(0, null, Money.zero(currency));
  }

  static of(params: {
    percentTolerance?: number;
    absoluteTolerance?: Money | null;
    autoApprovalUpTo?: Money | null;
  }): ThresholdPolicy {
    return new ThresholdPolicy(
      Math.max(0, params.percentTolerance ?? 0),
      params.absoluteTolerance ?? null,
      params.autoApprovalUpTo ?? null,
    );
  }

  isWithinTolerance(deviationPercent: number, deviationAmount: Money): boolean {
    if (deviationPercent <= this.percentTolerance) return true;
    if (
      this.absoluteTolerance &&
      !deviationAmount.greaterThan(this.absoluteTolerance)
    ) {
      return true;
    }
    return false;
  }

  /** Decide si la auditoría completa puede pre-aprobarse autónomamente. */
  qualifiesForAutoApproval(totalDeviation: Money): boolean {
    if (!this.autoApprovalUpTo) return false;
    return !totalDeviation.greaterThan(this.autoApprovalUpTo);
  }

  get percent(): number {
    return this.percentTolerance;
  }
  get absolute(): Money | null {
    return this.absoluteTolerance;
  }
  get autoApprovalLimit(): Money | null {
    return this.autoApprovalUpTo;
  }
}
