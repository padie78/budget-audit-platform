import type { ExtractedBudget } from '../entities/budget';
import type { LegalClauseRisk } from '../value-objects/legal-clause-risk';

export interface AiExtractionInput {
  s3Url: string;
  supplierName?: string;
  expectedCurrency?: string;
  /** Pista para el LLM sobre qué tipo de documento es. */
  documentKind?: 'QUOTE' | 'CONTRACT' | 'PURCHASE_ORDER' | 'INVOICE';
}

export interface AiExtractionResult {
  budget: ExtractedBudget;
  legalRisks: LegalClauseRisk[];
}

/**
 * Puerto de extracción del LLM. Trabaja con Structured Outputs y devuelve
 * (a) la data tabular del documento y (b) los riesgos legales detectados
 * en el texto libre si aplica.
 */
export interface IAiExtractorService {
  extract(input: AiExtractionInput): Promise<AiExtractionResult>;
}

export const AI_EXTRACTOR_SERVICE = Symbol('IAiExtractorService');
