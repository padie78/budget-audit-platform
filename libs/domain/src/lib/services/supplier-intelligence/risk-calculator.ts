/* =============================================================================
 * RiskCalculator — calcula `strategic_intelligence.risk_profile`.
 *
 * Modelo (todas las dimensiones en [0,1], 1 = peor):
 *   financial    = clamp(disputed / audited, 0, 1)
 *   operational  = 1 - reliabilityScore
 *   compliance   = mezcla de (1 - esg/100) y status no-ACTIVE
 *   concentration = % de spend del tenant concentrado en este proveedor
 *   external     = severidad agregada de señales externas
 *
 *   risk_raw = 0.30*fin + 0.25*ops + 0.20*comp + 0.15*conc + 0.10*ext
 *   score    = round((1 - risk_raw) * 100)   # 0..100, mayor = mejor
 *
 *   score < 35  -> CRITICAL
 *   score < 55  -> HIGH
 *   score < 75  -> MEDIUM
 *   else        -> LOW
 * ============================================================================= */

import {
  RiskProfile,
  type RiskLevel,
} from '../../value-objects/strategic-intelligence';
import type { ExternalRiskSignal } from './types';
import type { SupplierStatus } from '../../value-objects/compliance-and-risk';

export interface RiskInputs {
  totalAuditedDocs: number;
  totalDisputesRaised: number;
  reliabilityScore: number;
  esgComplianceScore: number;
  supplierStatus: SupplierStatus;
  /** % del spend del tenant concentrado en este proveedor, 0..1. */
  spendConcentration: number;
  externalSignals: ExternalRiskSignal[];
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  /** Desglose para auditoría / debugging. */
  components: {
    financial: number;
    operational: number;
    compliance: number;
    concentration: number;
    external: number;
  };
  riskProfile: RiskProfile;
}

const W = {
  financial: 0.30,
  operational: 0.25,
  compliance: 0.20,
  concentration: 0.15,
  external: 0.10,
} as const;

export class RiskCalculator {
  static compute(input: RiskInputs, now: Date = new Date()): RiskResult {
    const audited = Math.max(0, input.totalAuditedDocs | 0);
    const disputed = Math.max(0, input.totalDisputesRaised | 0);

    const financial = audited === 0 ? 0 : clamp01(disputed / audited);
    const operational = clamp01(1 - clamp01(input.reliabilityScore));

    const esgPenalty = clamp01(1 - clamp01((input.esgComplianceScore ?? 0) / 100));
    const statusPenalty = statusToPenalty(input.supplierStatus);
    const compliance = clamp01(0.6 * esgPenalty + 0.4 * statusPenalty);

    const concentration = clamp01(input.spendConcentration);

    const external = aggregateExternalSeverity(input.externalSignals, now);

    const riskRaw = clamp01(
      W.financial * financial +
        W.operational * operational +
        W.compliance * compliance +
        W.concentration * concentration +
        W.external * external,
    );

    const score = Math.round((1 - riskRaw) * 100);
    const level = scoreToLevel(score);

    const riskProfile = RiskProfile.of({
      score,
      level,
      lastCheck: truncateToDay(now),
    });

    return {
      score,
      level,
      components: { financial, operational, compliance, concentration, external },
      riskProfile,
    };
  }
}

function statusToPenalty(s: SupplierStatus): number {
  switch (s) {
    case 'ACTIVE':
      return 0;
    case 'SUSPENDED':
      return 0.6;
    case 'INACTIVE':
      return 0.7;
    case 'BLOCKED':
      return 1;
    default:
      return 0;
  }
}

/**
 * Agrega señales externas con decaimiento exponencial por antigüedad
 * (vida media = 90 días).
 */
function aggregateExternalSeverity(
  signals: ExternalRiskSignal[],
  now: Date,
): number {
  if (signals.length === 0) return 0;
  const HALF_LIFE_DAYS = 90;
  const decay = (ageDays: number) =>
    Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

  let total = 0;
  for (const s of signals) {
    const ageDays = Math.max(
      0,
      (now.getTime() - s.observedAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    total += clamp01(s.severity) * decay(ageDays);
  }
  return clamp01(total / signals.length);
}

function scoreToLevel(score: number): RiskLevel {
  if (score < 35) return 'CRITICAL';
  if (score < 55) return 'HIGH';
  if (score < 75) return 'MEDIUM';
  return 'LOW';
}

function truncateToDay(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
