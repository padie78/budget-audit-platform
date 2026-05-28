/* =============================================================================
 * TrendCalculator — calcula `vendor_performance.trend`.
 *
 * Modelo:
 *   Toma N últimas ventanas (típicamente 3 × 30 días) de reliabilityScore,
 *   calcula la pendiente OLS y aplica thresholds.
 *
 *     slope > +SLOPE_THRESHOLD  -> IMPROVING
 *     slope < -SLOPE_THRESHOLD  -> DEGRADING
 *     otherwise                 -> STABLE
 *
 * Si hay menos de 2 ventanas, devuelve STABLE (no hay tendencia detectable).
 * ============================================================================= */

import type { VendorTrend } from '../../value-objects/vendor-performance';
import type { PerformanceWindow } from './types';

const SLOPE_THRESHOLD = 0.02;
const DEFAULT_WINDOW_COUNT = 3;

export interface TrendInputs {
  windows: PerformanceWindow[];
  /** Cuántas ventanas recientes considerar. Default 3. */
  lookback?: number;
}

export interface TrendResult {
  trend: VendorTrend;
  slope: number;
  windowsUsed: number;
}

export class TrendCalculator {
  static compute(input: TrendInputs): TrendResult {
    const lookback = input.lookback ?? DEFAULT_WINDOW_COUNT;
    const recent = input.windows.slice(-lookback);

    if (recent.length < 2) {
      return { trend: 'STABLE', slope: 0, windowsUsed: recent.length };
    }

    const xs = recent.map((_, i) => i);
    const ys = recent.map((w) => w.reliabilityScore);
    const slope = ordinaryLeastSquaresSlope(xs, ys);

    let trend: VendorTrend = 'STABLE';
    if (slope > SLOPE_THRESHOLD) trend = 'IMPROVING';
    else if (slope < -SLOPE_THRESHOLD) trend = 'DEGRADING';

    return { trend, slope, windowsUsed: recent.length };
  }
}

function ordinaryLeastSquaresSlope(xs: number[], ys: number[]): number {
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
