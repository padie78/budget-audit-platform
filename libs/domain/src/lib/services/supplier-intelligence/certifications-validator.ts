/* =============================================================================
 * CertificationsValidator — valida `compliance_and_risk.certifications`
 * extraídas por el LLM antes de persistirlas.
 *
 * Reglas:
 *   - confidence >= MIN_CONFIDENCE
 *   - issuer ∈ ISSUER_WHITELIST (si está presente)
 *   - validUntil > now (vigentes)
 *   - nombre normalizado (uppercase + sin espacios duplicados)
 * ============================================================================= */

import type { ExtractedCertification } from './types';

const DEFAULT_MIN_CONFIDENCE = 0.80;

export const ISSUER_WHITELIST: readonly string[] = [
  'ISO',
  'AENOR',
  'BSI',
  'BUREAU VERITAS',
  'SGS',
  'TUV',
  'AICPA',
  'B LAB',
  'FAIRTRADE INTERNATIONAL',
  'FSC',
  'CDP',
  'GRI',
  'SBTI',
];

export interface CertificationsValidatorInputs {
  extracted: ExtractedCertification[];
  minConfidence?: number;
  /** Si false, se ignora la whitelist de issuers. */
  enforceIssuerWhitelist?: boolean;
}

export interface CertificationsValidatorResult {
  certifications: string[];
  rejected: { name: string; reason: string }[];
}

export class CertificationsValidator {
  static validate(
    input: CertificationsValidatorInputs,
    now: Date = new Date(),
  ): CertificationsValidatorResult {
    const min = input.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const enforce = input.enforceIssuerWhitelist ?? true;
    const allowedIssuers = new Set(
      ISSUER_WHITELIST.map((i) => i.toUpperCase()),
    );

    const accepted = new Set<string>();
    const rejected: { name: string; reason: string }[] = [];

    for (const cert of input.extracted) {
      const name = normalize(cert.name);
      if (!name) {
        rejected.push({ name: cert.name, reason: 'empty_name' });
        continue;
      }
      if (cert.confidence < min) {
        rejected.push({ name, reason: 'low_confidence' });
        continue;
      }
      if (cert.validUntil && cert.validUntil.getTime() < now.getTime()) {
        rejected.push({ name, reason: 'expired' });
        continue;
      }
      if (enforce && cert.issuer) {
        const issuerKey = cert.issuer.toUpperCase();
        const ok = [...allowedIssuers].some((w) => issuerKey.includes(w));
        if (!ok) {
          rejected.push({ name, reason: 'unknown_issuer' });
          continue;
        }
      }
      accepted.add(name);
    }

    return { certifications: [...accepted], rejected };
  }
}

function normalize(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '-');
}
