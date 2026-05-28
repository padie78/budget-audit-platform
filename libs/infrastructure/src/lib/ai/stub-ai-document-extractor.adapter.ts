/* =============================================================================
 * StubAiDocumentExtractor — implementación determinística del puerto
 * `IAiDocumentExtractor` para no acoplar el MVP a Bedrock/OpenAI todavía.
 *
 * Comportamiento:
 *   • Si el path del documento contiene tokens conocidos (iso-9001, soc2,
 *     b-corp, women-owned, ...), los detecta con `confidence: 0.95`.
 *   • Si no, devuelve lista vacía con alta confianza también (no inventa).
 *
 * Reemplazar por `OpenAiDocumentExtractor` o `BedrockDocumentExtractor` cuando
 * estén disponibles. Los use cases se mantienen sin tocar (port + adapter).
 * ============================================================================= */

import type {
  DiversityExtractionResult,
  DocumentRef,
  ExtractedCertification,
  IAiDocumentExtractor,
} from '@budget-audit/domain';

const CERTIFICATION_KEYWORDS: Record<
  string,
  { name: string; issuer: string }
> = {
  'iso-9001': { name: 'ISO-9001', issuer: 'ISO' },
  'iso-14001': { name: 'ISO-14001', issuer: 'ISO' },
  'iso-27001': { name: 'ISO-27001', issuer: 'ISO' },
  'iso-45001': { name: 'ISO-45001', issuer: 'ISO' },
  soc2: { name: 'SOC2', issuer: 'AICPA' },
  'b-corp': { name: 'B-CORP', issuer: 'B LAB' },
  fairtrade: { name: 'FAIR-TRADE', issuer: 'FAIRTRADE INTERNATIONAL' },
  fsc: { name: 'FSC', issuer: 'FSC' },
  gri: { name: 'GRI', issuer: 'GRI' },
  cdp: { name: 'CDP-A', issuer: 'CDP' },
};

const DIVERSITY_KEYWORDS: Record<string, string> = {
  'women-owned': 'WOMEN_OWNED',
  'minority-owned': 'MINORITY_OWNED',
  'veteran-owned': 'VETERAN_OWNED',
  'small-business': 'SMALL_BUSINESS',
  'lgbtq-owned': 'LGBTQ_OWNED',
  'disability-owned': 'DISABILITY_OWNED',
};

export class StubAiDocumentExtractor implements IAiDocumentExtractor {
  async extractCertifications(
    documents: DocumentRef[],
  ): Promise<ExtractedCertification[]> {
    const found = new Map<string, ExtractedCertification>();
    for (const doc of documents) {
      const path = doc.s3Url.toLowerCase();
      for (const [token, def] of Object.entries(CERTIFICATION_KEYWORDS)) {
        if (path.includes(token)) {
          found.set(def.name, {
            name: def.name,
            issuer: def.issuer,
            validFrom: null,
            validUntil: nextYear(),
            confidence: 0.95,
          });
        }
      }
    }
    return [...found.values()];
  }

  async extractDiversityClaims(
    documents: DocumentRef[],
  ): Promise<DiversityExtractionResult[]> {
    const found = new Map<string, DiversityExtractionResult>();
    for (const doc of documents) {
      const path = doc.s3Url.toLowerCase();
      for (const [token, tag] of Object.entries(DIVERSITY_KEYWORDS)) {
        if (path.includes(token)) {
          found.set(tag, {
            tag,
            confidence: 0.9,
            validUntil: nextYear(),
          });
        }
      }
    }
    return [...found.values()];
  }
}

function nextYear(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}
