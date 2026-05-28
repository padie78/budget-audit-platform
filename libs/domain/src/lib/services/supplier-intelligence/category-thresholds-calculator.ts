/* =============================================================================
 * CategoryThresholdsCalculator — sugiere `smart_thresholds.categories`.
 *
 * Modelo no paramétrico (no requiere ML):
 *   Para cada categoría con >= MIN_SAMPLES eventos:
 *     p90 = percentile(|deviation_percent|, 90)
 *     suggested = clamp(p90 * 1.1, defaultTolerance, defaultTolerance * 3)
 *
 *   Categorías con datos insuficientes heredan `defaultTolerance`.
 *
 * Pure function — recibe el historial agregado por categoría.
 * ============================================================================= */

import { SmartThresholds } from '../../value-objects/smart-thresholds';
import type { AuditEvent } from './types';

export interface CategoryThresholdsInputs {
  events: AuditEvent[];
  defaultTolerancePercentage: number;
  /** Mínimo de muestras para sugerir override. Default 20. */
  minSamples?: number;
}

export interface CategoryThresholdsResult {
  /** Mapa categoría → tolerance % sugerida. */
  byCategory: Record<string, number>;
  /** Categorías que no alcanzaron MIN_SAMPLES (heredarán default). */
  insufficient: string[];
  smartThresholds: SmartThresholds;
}

const DEFAULT_MIN_SAMPLES = 20;
const SAFETY_FACTOR = 1.1;
const MAX_FACTOR_VS_DEFAULT = 3;

export class CategoryThresholdsCalculator {
  static compute(input: CategoryThresholdsInputs): CategoryThresholdsResult {
    const minSamples = input.minSamples ?? DEFAULT_MIN_SAMPLES;
    const groups = groupBy(input.events, (e) => e.category ?? 'UNCATEGORIZED');

    const byCategory: Record<string, number> = {};
    const insufficient: string[] = [];
    const maxAllowed = input.defaultTolerancePercentage * MAX_FACTOR_VS_DEFAULT;

    for (const [category, evts] of groups.entries()) {
      if (evts.length < minSamples) {
        insufficient.push(category);
        continue;
      }
      const abs = evts.map((e) => Math.abs(e.deviationPercent));
      const p90 = percentile(abs, 90);
      const suggested = clamp(
        p90 * SAFETY_FACTOR,
        input.defaultTolerancePercentage,
        maxAllowed,
      );
      byCategory[category] = round2(suggested);
    }

    const smartThresholds = SmartThresholds.fromRecord(
      input.defaultTolerancePercentage,
      byCategory,
    );

    return { byCategory, insufficient, smartThresholds };
  }
}

function groupBy<T, K>(list: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of list) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

/**
 * Percentil tipo "linear interpolation" (mismo método que numpy default).
 * `p` en 0..100.
 */
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = ((p / 100) * (sorted.length - 1));
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
