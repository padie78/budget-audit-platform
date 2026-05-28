import { Money } from './money';

/**
 * Proyección del CFO: dado el desvío actual y la velocidad del proyecto,
 * estima el sobrecosto anualizado y el impacto en márgenes.
 *
 *  - `monthlyOverrun`: sobrecosto proyectado mes a mes basado en el burn rate.
 *  - `annualizedOverrun`: monto que el sobrecosto representará al cierre del
 *    ejercicio si no se interviene.
 *  - `marginErosionPercent`: cuántos puntos porcentuales de margen se pierden.
 */
export interface CashFlowProjectionInput {
  totalDeviation: Money;
  contractValue: Money;
  projectDurationMonths: number;
  elapsedMonths: number;
}

export class CashFlowProjection {
  private constructor(
    readonly monthlyOverrun: Money,
    readonly annualizedOverrun: Money,
    readonly projectedFinalOverrun: Money,
    readonly marginErosionPercent: number,
  ) {}

  static compute(input: CashFlowProjectionInput): CashFlowProjection {
    const elapsed = Math.max(input.elapsedMonths, 1);
    const monthly = input.totalDeviation.multiply(1 / elapsed);
    const annualized = monthly.multiply(12);
    const remaining = Math.max(input.projectDurationMonths - elapsed, 0);
    const projectedFinal = input.totalDeviation.add(monthly.multiply(remaining));

    const contractValue = input.contractValue.amount;
    const marginErosion =
      contractValue > 0
        ? (projectedFinal.amount / contractValue) * 100
        : 0;

    return new CashFlowProjection(monthly, annualized, projectedFinal, marginErosion);
  }
}
