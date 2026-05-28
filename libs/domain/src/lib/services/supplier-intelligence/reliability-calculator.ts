/* =============================================================================
 * ReliabilityCalculator — fórmula de `vendor_performance.reliability_score`.
 *
 * Pure function, sin side effects. Testeable sin AWS.
 *
 * Modelo:
 *   clean_doc_rate    = (audited - disputed) / audited
 *   sla_rate          = slaDeliveryComplianceRate (0..1)
 *   dispute_penalty   = min(1, disputes / audited)
 *
 *   computed = 0.55*clean + 0.30*sla + 0.15*(1 - dispute_penalty)
 *
 * Bootstrap: si audited < umbral, interpola con prior `fidelity_score/100`
 * según el peso de evidencia (w = min(1, audited / 10)).
 * ============================================================================= */

export interface ReliabilityInputs {
  totalAuditedDocs: number;
  totalDisputesRaised: number;
  slaDeliveryComplianceRate: number;
  /** Prior: 0..100. */
  fidelityScore: number;
}

export interface ReliabilityResult {
  /** Recalculated, 0..1. */
  reliabilityScore: number;
  /** Peso de evidencia 0..1 — 0 = sólo prior, 1 = sólo histórico. */
  evidenceWeight: number;
}

const WEIGHT_CLEAN = 0.55;
const WEIGHT_SLA = 0.30;
const WEIGHT_DISPUTE = 0.15;
const FULL_EVIDENCE_AT = 10;

export class ReliabilityCalculator {
  static compute(input: ReliabilityInputs): ReliabilityResult {
    const audited = Math.max(0, input.totalAuditedDocs | 0);
    const disputed = Math.max(0, input.totalDisputesRaised | 0);
    const slaRate = clamp01(input.slaDeliveryComplianceRate);
    const prior = clamp01((input.fidelityScore ?? 0) / 100);

    const cleanRate = audited === 0 ? prior : Math.max(0, (audited - disputed) / audited);
    const disputePenalty = audited === 0 ? 0 : Math.min(1, disputed / audited);

    const computed = clamp01(
      WEIGHT_CLEAN * cleanRate +
        WEIGHT_SLA * slaRate +
        WEIGHT_DISPUTE * (1 - disputePenalty),
    );

    const w = Math.min(1, audited / FULL_EVIDENCE_AT);
    const reliabilityScore = clamp01(w * computed + (1 - w) * prior);

    return { reliabilityScore, evidenceWeight: w };
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
