import OpenAI from 'openai';
import {
  BudgetExtractionError,
  LegalClauseRisk,
  Money,
  type AiExtractionInput,
  type AiExtractionResult,
  type ExtractedBudgetItem,
  type IAiExtractorService,
  type LegalRiskCategory,
} from '@budget-audit/domain';
import {
  ExtractedDocumentJsonSchema,
  ExtractedDocumentSchema,
} from './budget-extraction.schema';

export interface OpenAiExtractorOptions {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `Eres un auditor experto en compras B2B.
Recibirás un documento del ciclo de compras (cotización, contrato, OC o factura)
referenciado por URL en S3. Realiza DOS tareas:

  1) Extrae cada ítem (SKU, descripción, unidad, cantidad, precio unitario y
     total de línea). No inventes ítems ni precios.
  2) Identifica cláusulas legales con riesgo (penalidades, liability, plazos
     de pago abusivos, terminación unilateral, ajustes de precio, SLA, etc.)
     y asigna riskScore [0,1] y modelConfidence [0,1].

Devuelve EXACTAMENTE el JSON definido por el schema. Para riesgos usa
clauseId del estilo "CL-N" con N incremental. Si no hay texto legal, deja
legalText=null y legalRisks=[].`;

/**
 * Adaptador del puerto IAiExtractorService basado en OpenAI Structured
 * Outputs. Una sola llamada al LLM devuelve la data tabular Y los riesgos
 * legales, manteniendo costo y latencia bajos.
 */
export class OpenAiBudgetExtractorAdapter implements IAiExtractorService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(options: OpenAiExtractorOptions = {}) {
    const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY no está configurada.');

    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? process.env['OPENAI_MODEL'] ?? 'gpt-4o-2024-08-06';
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  async extract(input: AiExtractionInput): Promise<AiExtractionResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: this.buildUserPrompt(input) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ExtractedDocument',
          strict: true,
          schema: ExtractedDocumentJsonSchema as Record<string, unknown>,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new BudgetExtractionError('Respuesta vacía del LLM.');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new BudgetExtractionError(`JSON inválido del LLM: ${(err as Error).message}`);
    }

    const validation = ExtractedDocumentSchema.safeParse(parsed);
    if (!validation.success) {
      throw new BudgetExtractionError(
        `Schema mismatch: ${validation.error.message}`,
      );
    }

    return this.toDomain(validation.data);
  }

  private buildUserPrompt(input: AiExtractionInput): string {
    const parts = [`Documento: ${input.s3Url}`];
    if (input.documentKind) parts.push(`Tipo de documento: ${input.documentKind}`);
    if (input.supplierName) parts.push(`Proveedor declarado: ${input.supplierName}`);
    if (input.expectedCurrency) parts.push(`Moneda esperada: ${input.expectedCurrency}`);
    parts.push('Extrae ítems y riesgos legales.');
    return parts.join('\n');
  }

  private toDomain(
    data: import('./budget-extraction.schema').ExtractedDocumentSchemaType,
  ): AiExtractionResult {
    const items: ExtractedBudgetItem[] = data.items.map((it) => ({
      sku: it.sku,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: Money.from(it.unitPrice, data.currency),
      lineTotal: Money.from(it.lineTotal, data.currency),
    }));

    const legalRisks = data.legalRisks.map((r) =>
      LegalClauseRisk.of({
        clauseId: r.clauseId,
        category: r.category as LegalRiskCategory,
        excerpt: r.excerpt,
        rationale: r.rationale,
        modelConfidence: r.modelConfidence,
        riskScore: r.riskScore,
        suggestion: r.suggestion,
      }),
    );

    return {
      budget: {
        supplierName: data.supplierName,
        quoteNumber: data.quoteNumber,
        currency: data.currency,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        items,
        totalAmount: Money.from(data.totalAmount, data.currency),
        legalText: data.legalText ?? undefined,
      },
      legalRisks,
    };
  }
}
