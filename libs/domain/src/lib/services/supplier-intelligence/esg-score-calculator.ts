/* =============================================================================
 * EsgScoreCalculator — calcula `compliance_and_risk.esg_compliance_score`.
 *
 * Modelo:
 *   cert_score    = Σ weight(c) for c in certifications      (capped a 100)
 *   sector_factor = SECTOR_BASELINE[primary_sector_code]     (0..1)
 *   audit_factor  = avg(esg_audit_scores_last_12m)           (0..100)
 *
 *   esg = 0.40 * min(100, cert_score) +
 *         0.35 * audit_factor +
 *         0.25 * sector_factor * 100
 *
 *   clamp(esg, 0, 100)
 *
 * Si no hay auditorías ESG recientes (`audit_factor` = null), se redistribuye
 * el peso 0.35 proporcionalmente a las otras dos dimensiones.
 * ============================================================================= */

/** Pesos por certificación, curados manualmente (admin tunables). */
export const DEFAULT_CERT_WEIGHTS: Readonly<Record<string, number>> = {
  'ISO-9001': 10,
  'ISO-14001': 20,
  'ISO-45001': 10,
  'ISO-27001': 10,
  'SOC2': 15,
  'SOC2-TYPE-II': 20,
  'B-CORP': 25,
  'FAIR-TRADE': 15,
  'FSC': 15,
  'GRI': 20,
  'CDP-A': 25,
  'SBT-VALIDATED': 25,
};

/** Baseline ESG por sector (0..1) — heurística inicial, ajustable. */
export const DEFAULT_SECTOR_BASELINE: Readonly<Record<string, number>> = {
  RAW_MATERIALS: 0.45,
  LOGISTICS: 0.50,
  MAINTENANCE: 0.55,
  IT_SERVICES: 0.70,
  MARKETING: 0.60,
  ENERGY: 0.40,
  GENERAL: 0.55,
};

export interface EsgInputs {
  certifications: string[];
  primarySectorCode: string;
  /** Scores ESG de auditorías de los últimos 12 meses (0..100), opcional. */
  recentEsgAuditScores?: number[];
  /** Overrides opcionales para tunear sin tocar dominio. */
  certWeights?: Record<string, number>;
  sectorBaseline?: Record<string, number>;
}

export interface EsgResult {
  esgComplianceScore: number;
  components: {
    certScore: number;
    sectorFactor: number;
    auditFactor: number | null;
  };
}

export class EsgScoreCalculator {
  static compute(input: EsgInputs): EsgResult {
    const weights = { ...DEFAULT_CERT_WEIGHTS, ...(input.certWeights ?? {}) };
    const sectorTable = { ...DEFAULT_SECTOR_BASELINE, ...(input.sectorBaseline ?? {}) };

    const certScoreRaw = input.certifications.reduce(
      (sum, c) => sum + (weights[c] ?? 0),
      0,
    );
    const certScore = Math.min(100, certScoreRaw);

    const sectorFactor =
      sectorTable[input.primarySectorCode] ?? sectorTable.GENERAL ?? 0.5;

    const auditScores = input.recentEsgAuditScores ?? [];
    const auditFactor =
      auditScores.length === 0
        ? null
        : clamp(0, 100, auditScores.reduce((a, b) => a + b, 0) / auditScores.length);

    let esg: number;
    if (auditFactor === null) {
      esg = 0.62 * certScore + 0.38 * sectorFactor * 100;
    } else {
      esg = 0.40 * certScore + 0.35 * auditFactor + 0.25 * sectorFactor * 100;
    }

    return {
      esgComplianceScore: round1(clamp(0, 100, esg)),
      components: { certScore, sectorFactor, auditFactor },
    };
  }
}

function clamp(lo: number, hi: number, n: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
