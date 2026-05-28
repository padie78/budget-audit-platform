import { Money } from './money';
import { AlertSeverity } from './alert-severity';

/* =============================================================================
 * Predictive Engine — proyecciones del contrato (agotamiento, drift, P90).
 * Alimentado por el motor predictivo del backend (stats lambda + LLM).
 * ============================================================================= */

export type DriftRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PredictiveEngineProps {
  estimatedDepletionDate: Date;
  burnRateSeverity: AlertSeverity;
  inflationAdjustmentAlert: Date | null;
  p90WorstCaseSpend: Money;
  contractDriftRisk: DriftRisk;
}

export class PredictiveEngine {
  private constructor(private readonly props: PredictiveEngineProps) {}

  static of(props: PredictiveEngineProps): PredictiveEngine {
    return new PredictiveEngine(props);
  }

  get estimatedDepletionDate(): Date {
    return this.props.estimatedDepletionDate;
  }
  get burnRateSeverity(): AlertSeverity { return this.props.burnRateSeverity; }
  get inflationAdjustmentAlert(): Date | null {
    return this.props.inflationAdjustmentAlert;
  }
  get p90WorstCaseSpend(): Money { return this.props.p90WorstCaseSpend; }
  get contractDriftRisk(): DriftRisk { return this.props.contractDriftRisk; }

  /** ¿Quedan menos de N días para el agotamiento estimado? */
  isApproachingDepletion(thresholdDays: number, now: Date = new Date()): boolean {
    const diffMs = this.props.estimatedDepletionDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= thresholdDays;
  }
}
