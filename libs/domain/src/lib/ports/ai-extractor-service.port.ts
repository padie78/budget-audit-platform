import type { ExtractedBudget } from '../entities/budget';

export interface AiExtractionInput {
  s3Url: string;
  supplierName?: string;
  expectedCurrency?: string;
}

/**
 * Puerto del dominio para extraer datos estructurados desde un PDF de
 * presupuesto. La implementación concreta puede ser OpenAI Structured Outputs,
 * Amazon Bedrock con un schema JSON o cualquier otro proveedor.
 */
export interface IAiExtractorService {
  extract(input: AiExtractionInput): Promise<ExtractedBudget>;
}

export const AI_EXTRACTOR_SERVICE = Symbol('IAiExtractorService');
