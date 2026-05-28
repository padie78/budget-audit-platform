import OpenAI from 'openai';
import {
  type Budget,
  type DisputeEmail,
  type IDisputeWriterService,
  type Supplier,
} from '@budget-audit/domain';
import {
  DisputeEmailJsonSchema,
  DisputeEmailSchema,
} from './budget-extraction.schema';

export interface OpenAiDisputeWriterOptions {
  apiKey?: string;
  model?: string;
}

const SYSTEM_PROMPT = `Eres un Procurement Manager senior. Redacta un correo
formal de reclamo al proveedor cuando detectamos desvíos de precio, riesgos
legales o inconsistencias de three-way matching. Tono profesional, firme y
constructivo. Idioma: español neutro. No incluyas saludos genéricos vacíos;
sé específico sobre los puntos detectados.

Devuelve EXACTAMENTE el JSON del schema. No agregues markdown.`;

export class OpenAiDisputeWriterAdapter implements IDisputeWriterService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAiDisputeWriterOptions = {}) {
    const apiKey = options.apiKey ?? process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY no está configurada.');
    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? process.env['OPENAI_MODEL'] ?? 'gpt-4o-2024-08-06';
  }

  async draft(input: { budget: Budget; supplier: Supplier }): Promise<DisputeEmail> {
    const userPrompt = this.buildPrompt(input);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'DisputeEmail',
          strict: true,
          schema: DisputeEmailJsonSchema as Record<string, unknown>,
        },
      },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Respuesta vacía del LLM (dispute writer).');

    const parsed = JSON.parse(raw);
    const validated = DisputeEmailSchema.parse(parsed);

    return {
      to: validated.to,
      cc: validated.cc,
      subject: validated.subject,
      body: validated.body,
      highlightedPoints: validated.highlightedPoints,
      attachmentUrl: null,
      draftedAt: new Date(),
    };
  }

  private buildPrompt(input: { budget: Budget; supplier: Supplier }): string {
    const { budget, supplier } = input;
    const reds = budget.discrepancies.filter((d) => d.severity === 'RED');
    const legal = budget.legalRisks.filter((r) => r.severity !== 'GREEN');

    return [
      `Proveedor: ${supplier.name} <${supplier.contactEmail}>`,
      `Auditoría ID: ${budget.id}`,
      `Decisión automática: ${budget.decision}`,
      `Sobreprecio total: ${budget.totalDeviation?.amount.toFixed(2) ?? 0}`,
      `Desvío %: ${budget.totalDeviationPercent.toFixed(2)}%`,
      '',
      `Discrepancias críticas (${reds.length}):`,
      ...reds.slice(0, 20).map(
        (d) =>
          `- ${d.sku} ${d.description}: pactado ${d.agreedUnitPrice?.amount ?? 'N/D'}, cotizado ${d.quotedUnitPrice.amount}, desvío ${d.deviationPercent.toFixed(2)}%, impacto ${d.projectedImpact.amount.toFixed(2)}`,
      ),
      '',
      `Riesgos legales relevantes (${legal.length}):`,
      ...legal.slice(0, 10).map((r) => `- [${r.category}] ${r.excerpt} — ${r.rationale}`),
      '',
      'Redacta el reclamo. El "to" debe ser el email del proveedor.',
    ].join('\n');
  }
}
