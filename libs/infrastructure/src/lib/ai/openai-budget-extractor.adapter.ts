import OpenAI from 'openai';
import {
  BudgetExtractionError,
  Money,
  type AiExtractionInput,
  type ExtractedBudget,
  type ExtractedBudgetItem,
  type IAiExtractorService,
} from '@budget-audit/domain';
import {
  ExtractedBudgetJsonSchema,
  ExtractedBudgetSchema,
} from './budget-extraction.schema';

export interface OpenAiExtractorOptions {
  apiKey?: string;
  model?: string;
  /** Prompt del sistema. Puede sobreescribirse para fine-tuning por industria. */
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `Eres un experto en auditoría de presupuestos B2B.
Recibirás un PDF (referenciado por URL en S3) que contiene un presupuesto
emitido por un proveedor. Extrae cada ítem con su SKU, descripción, unidad,
cantidad, precio unitario y total de línea. Devuelve los datos EXACTAMENTE
según el JSON Schema provisto. No inventes ítems ni precios. Si un dato no
está presente, usa null cuando el schema lo permita.`;

/**
 * Adaptador del puerto IAiExtractorService basado en OpenAI Structured Outputs.
 *
 *  - Usa `response_format: { type: 'json_schema', json_schema: {...} }` con
 *    `strict: true` para garantizar conformidad estructural.
 *  - Valida la respuesta una segunda vez con Zod antes de mapearla al dominio,
 *    como defensa en profundidad.
 *  - Puede intercambiarse trivialmente por un adaptador Bedrock (Anthropic /
 *    Llama) manteniendo la misma firma del puerto.
 */
export class OpenAiBudgetExtractorAdapter implements IAiExtractorService {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly systemPrompt: string;

  constructor(options: OpenAiExtractorOptions = {}) {
    const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY no está configurada.');
    }
    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? process.env['OPENAI_MODEL'] ?? 'gpt-4o-2024-08-06';
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  }

  async extract(input: AiExtractionInput): Promise<ExtractedBudget> {
    const userPrompt = this.buildUserPrompt(input);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ExtractedBudget',
          strict: true,
          schema: ExtractedBudgetJsonSchema as Record<string, unknown>,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new BudgetExtractionError('Respuesta vacía del LLM.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new BudgetExtractionError(
        `JSON inválido del LLM: ${(err as Error).message}`,
      );
    }

    const validation = ExtractedBudgetSchema.safeParse(parsed);
    if (!validation.success) {
      throw new BudgetExtractionError(
        `Respuesta no cumple el schema: ${validation.error.message}`,
      );
    }

    return this.toDomain(validation.data);
  }

  private buildUserPrompt(input: AiExtractionInput): string {
    const currencyHint = input.expectedCurrency
      ? `\nMoneda esperada: ${input.expectedCurrency}.`
      : '';
    const supplierHint = input.supplierName
      ? `\nProveedor declarado: ${input.supplierName}.`
      : '';
    return `Analiza el presupuesto ubicado en: ${input.s3Url}.${supplierHint}${currencyHint}\nExtrae todos los ítems con sus precios.`;
  }

  private toDomain(
    data: import('./budget-extraction.schema').ExtractedBudgetSchemaType,
  ): ExtractedBudget {
    const items: ExtractedBudgetItem[] = data.items.map((it) => ({
      sku: it.sku,
      description: it.description,
      unit: it.unit,
      quantity: it.quantity,
      unitPrice: Money.from(it.unitPrice, data.currency),
      lineTotal: Money.from(it.lineTotal, data.currency),
    }));

    return {
      supplierName: data.supplierName,
      quoteNumber: data.quoteNumber,
      currency: data.currency,
      issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
      items,
      totalAmount: Money.from(data.totalAmount, data.currency),
    };
  }
}
