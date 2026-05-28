import type {
  ExtractedCertification,
  ExternalRiskSignal,
} from '../services/supplier-intelligence/types';

export interface DocumentRef {
  /** S3 URI o URL del documento (PDF/imagen). */
  s3Url: string;
  /** Pista opcional para el LLM. */
  documentKind?: 'CERTIFICATION' | 'LEGAL' | 'DIVERSITY' | 'OTHER';
}

export interface DiversityExtractionResult {
  tag: string;
  confidence: number;
  validUntil?: Date | null;
}

/**
 * Puerto LLM/visión para extraer información estructurada de documentos
 * cargados por el proveedor. Distinto a `IAiExtractorService` (auditoría)
 * porque este se especializa en compliance/diversity/certs.
 */
export interface IAiDocumentExtractor {
  /** Detecta certificaciones (ISO, SOC2, B-Corp, ...) en un set de docs. */
  extractCertifications(
    documents: DocumentRef[],
  ): Promise<ExtractedCertification[]>;

  /** Detecta tags de diversidad (WOMEN_OWNED, MINORITY_OWNED, ...). */
  extractDiversityClaims(
    documents: DocumentRef[],
  ): Promise<DiversityExtractionResult[]>;
}

export const AI_DOCUMENT_EXTRACTOR = Symbol('IAiDocumentExtractor');

/**
 * Puerto para señales externas — noticias adversas, sanciones, listas OFAC,
 * etc. Drives `risk.external`.
 */
export interface IExternalRiskSignalsService {
  fetch(tenantId: string, supplierId: string): Promise<ExternalRiskSignal[]>;
}

export const EXTERNAL_RISK_SIGNALS = Symbol('IExternalRiskSignalsService');
