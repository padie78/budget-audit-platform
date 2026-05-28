import { Money } from './money';
import { AlertSeverity } from './alert-severity';
import { LegalClauseRisk } from './legal-clause-risk';
import { DisputeWorkflow } from './dispute-workflow';

/* =============================================================================
 * AI Analysis — bloque consolidado del análisis del LLM en una auditoría.
 *
 * Composición:
 *   - `priceDiscrepancy` (resumen ejecutivo agregado del overcost por línea)
 *   - `legalClauseRisks` (lista de riesgos legales detectados)
 *   - `disputeWorkflow`  (workflow del proceso de disputa)
 *
 * Las discrepancias granulares por SKU siguen viviendo en `Budget.discrepancies`
 * — este VO solo expone el resumen ejecutivo para reporting.
 * ============================================================================= */

export interface PriceDiscrepancySummaryProps {
  detectedOvercost: Money;
  /** Desvío % agregado del documento. */
  deviationPercentage: number;
  severityLevel: AlertSeverity;
  /** Precio benchmark del mercado (median externo) si el LLM lo provee. */
  marketBenchmarkPrice: Money | null;
}

export class PriceDiscrepancySummary {
  private constructor(private readonly props: PriceDiscrepancySummaryProps) {}

  static of(props: PriceDiscrepancySummaryProps): PriceDiscrepancySummary {
    return new PriceDiscrepancySummary(props);
  }

  get detectedOvercost(): Money { return this.props.detectedOvercost; }
  get deviationPercentage(): number { return this.props.deviationPercentage; }
  get severityLevel(): AlertSeverity { return this.props.severityLevel; }
  get marketBenchmarkPrice(): Money | null {
    return this.props.marketBenchmarkPrice;
  }
}

export interface AiAnalysisProps {
  priceDiscrepancy: PriceDiscrepancySummary | null;
  legalClauseRisks: ReadonlyArray<LegalClauseRisk>;
  disputeWorkflow: DisputeWorkflow | null;
}

export class AiAnalysis {
  private constructor(private readonly props: AiAnalysisProps) {}

  static empty(): AiAnalysis {
    return new AiAnalysis({
      priceDiscrepancy: null,
      legalClauseRisks: [],
      disputeWorkflow: null,
    });
  }

  static of(props: Partial<AiAnalysisProps>): AiAnalysis {
    return new AiAnalysis({
      priceDiscrepancy: props.priceDiscrepancy ?? null,
      legalClauseRisks: props.legalClauseRisks ?? [],
      disputeWorkflow: props.disputeWorkflow ?? null,
    });
  }

  withDisputeWorkflow(workflow: DisputeWorkflow): AiAnalysis {
    return new AiAnalysis({ ...this.props, disputeWorkflow: workflow });
  }

  withPriceDiscrepancy(summary: PriceDiscrepancySummary): AiAnalysis {
    return new AiAnalysis({ ...this.props, priceDiscrepancy: summary });
  }

  withLegalRisks(risks: ReadonlyArray<LegalClauseRisk>): AiAnalysis {
    return new AiAnalysis({ ...this.props, legalClauseRisks: risks });
  }

  get priceDiscrepancy(): PriceDiscrepancySummary | null {
    return this.props.priceDiscrepancy;
  }
  get legalClauseRisks(): ReadonlyArray<LegalClauseRisk> {
    return this.props.legalClauseRisks;
  }
  get disputeWorkflow(): DisputeWorkflow | null {
    return this.props.disputeWorkflow;
  }
}
