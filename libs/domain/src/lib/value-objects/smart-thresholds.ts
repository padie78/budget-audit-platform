/* =============================================================================
 * Smart Thresholds (extensión por categoría) — convive con `ThresholdPolicy`.
 *
 * `ThresholdPolicy` representa el "contrato de auto-aprobación" usado por la
 * lógica de decisión del agregado Budget. `SmartThresholds` (este VO) añade
 * matices por categoría operacional (RAW_MATERIALS, LOGISTICS, ...) que el LLM
 * y el auditor de gastos consultan para decidir severidad por línea.
 * ============================================================================= */

export interface SmartThresholdsProps {
  /** Tolerancia % por defecto. */
  defaultTolerancePercentage: number;
  /** Mapa CategoryName → tolerance % (overrides puntuales). */
  categories: ReadonlyMap<string, number>;
}

export class SmartThresholds {
  private constructor(private readonly props: SmartThresholdsProps) {}

  static of(props: SmartThresholdsProps): SmartThresholds {
    if (props.defaultTolerancePercentage < 0) {
      throw new Error('defaultTolerancePercentage no puede ser negativo.');
    }
    for (const [cat, value] of props.categories.entries()) {
      if (value < 0) {
        throw new Error(
          `Tolerance % negativo para la categoría "${cat}": ${value}`,
        );
      }
    }
    return new SmartThresholds(props);
  }

  static fromRecord(
    defaultTolerancePercentage: number,
    categories: Record<string, number>,
  ): SmartThresholds {
    return SmartThresholds.of({
      defaultTolerancePercentage,
      categories: new Map(Object.entries(categories)),
    });
  }

  /** Devuelve la tolerancia que aplica a una categoría (cae al default). */
  toleranceFor(category: string | null | undefined): number {
    if (!category) return this.props.defaultTolerancePercentage;
    return (
      this.props.categories.get(category) ??
      this.props.defaultTolerancePercentage
    );
  }

  get defaultTolerancePercentage(): number {
    return this.props.defaultTolerancePercentage;
  }
  get categories(): ReadonlyMap<string, number> {
    return this.props.categories;
  }
}
