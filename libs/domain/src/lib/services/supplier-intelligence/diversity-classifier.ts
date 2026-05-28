/* =============================================================================
 * DiversityClassifier — valida tags de `strategic_intelligence.diversity_status`.
 *
 * No invoca el LLM: recibe los hallazgos ya extraídos por el port
 * IAiDocumentExtractor y filtra por confianza y vigencia.
 *
 *   tag accepted sii
 *     finding.confidence >= MIN_CONFIDENCE      (0.85 por default)
 *     AND validUntil is null OR validUntil > now
 *     AND tag está en el catálogo soportado
 * ============================================================================= */

export const SUPPORTED_DIVERSITY_TAGS = [
  'WOMEN_OWNED',
  'MINORITY_OWNED',
  'VETERAN_OWNED',
  'SMALL_BUSINESS',
  'LGBTQ_OWNED',
  'DISABILITY_OWNED',
  'INDIGENOUS_OWNED',
] as const;

export type DiversityTag = (typeof SUPPORTED_DIVERSITY_TAGS)[number];

export interface DiversityFinding {
  tag: string;
  confidence: number;
  validUntil?: Date | null;
}

export interface DiversityClassifierInputs {
  findings: DiversityFinding[];
  minConfidence?: number;
}

export interface DiversityClassifierResult {
  diversityStatus: DiversityTag[];
  rejected: { tag: string; reason: 'low_confidence' | 'expired' | 'unsupported' }[];
}

const DEFAULT_MIN_CONFIDENCE = 0.85;

export class DiversityClassifier {
  static classify(
    input: DiversityClassifierInputs,
    now: Date = new Date(),
  ): DiversityClassifierResult {
    const min = input.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
    const supported = new Set<string>(SUPPORTED_DIVERSITY_TAGS);

    const accepted = new Set<DiversityTag>();
    const rejected: DiversityClassifierResult['rejected'] = [];

    for (const f of input.findings) {
      const tag = f.tag.toUpperCase();
      if (!supported.has(tag)) {
        rejected.push({ tag, reason: 'unsupported' });
        continue;
      }
      if (f.confidence < min) {
        rejected.push({ tag, reason: 'low_confidence' });
        continue;
      }
      if (f.validUntil && f.validUntil.getTime() < now.getTime()) {
        rejected.push({ tag, reason: 'expired' });
        continue;
      }
      accepted.add(tag as DiversityTag);
    }

    return { diversityStatus: [...accepted], rejected };
  }
}
