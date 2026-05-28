import { z } from 'zod';

/**
 * JSON Schema (Zod + raw) usado por el LLM en Structured Outputs.
 * Cubre extracción tabular (ítems del documento) y riesgos legales en
 * el texto libre. La doble validación (LLM strict + Zod) protege contra
 * derivas si se cambia de modelo.
 */
export const ExtractedBudgetItemSchema = z.object({
  sku: z.string(),
  description: z.string(),
  unit: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
});

export const LegalRiskSchema = z.object({
  clauseId: z.string(),
  category: z.enum([
    'PAYMENT_TERMS',
    'PENALTY',
    'LIABILITY',
    'TERMINATION',
    'CONFIDENTIALITY',
    'SLA',
    'PRICE_ADJUSTMENT',
    'OTHER',
  ]),
  excerpt: z.string(),
  rationale: z.string(),
  modelConfidence: z.number().min(0).max(1),
  riskScore: z.number().min(0).max(1),
  suggestion: z.string().nullable(),
});

export const ExtractedDocumentSchema = z.object({
  supplierName: z.string(),
  quoteNumber: z.string().nullable(),
  currency: z.string().length(3),
  issuedAt: z.string().nullable(),
  items: z.array(ExtractedBudgetItemSchema).min(1),
  totalAmount: z.number().nonnegative(),
  legalText: z.string().nullable(),
  legalRisks: z.array(LegalRiskSchema),
});

export type ExtractedDocumentSchemaType = z.infer<typeof ExtractedDocumentSchema>;

export const ExtractedDocumentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'supplierName',
    'quoteNumber',
    'currency',
    'issuedAt',
    'items',
    'totalAmount',
    'legalText',
    'legalRisks',
  ],
  properties: {
    supplierName: { type: 'string' },
    quoteNumber: { type: ['string', 'null'] },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    issuedAt: { type: ['string', 'null'] },
    totalAmount: { type: 'number' },
    legalText: { type: ['string', 'null'] },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['sku', 'description', 'unit', 'quantity', 'unitPrice', 'lineTotal'],
        properties: {
          sku: { type: 'string' },
          description: { type: 'string' },
          unit: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          lineTotal: { type: 'number' },
        },
      },
    },
    legalRisks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'clauseId',
          'category',
          'excerpt',
          'rationale',
          'modelConfidence',
          'riskScore',
          'suggestion',
        ],
        properties: {
          clauseId: { type: 'string' },
          category: {
            type: 'string',
            enum: [
              'PAYMENT_TERMS',
              'PENALTY',
              'LIABILITY',
              'TERMINATION',
              'CONFIDENTIALITY',
              'SLA',
              'PRICE_ADJUSTMENT',
              'OTHER',
            ],
          },
          excerpt: { type: 'string' },
          rationale: { type: 'string' },
          modelConfidence: { type: 'number' },
          riskScore: { type: 'number' },
          suggestion: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export const DisputeEmailSchema = z.object({
  to: z.string().email(),
  cc: z.array(z.string().email()),
  subject: z.string().min(1),
  body: z.string().min(20),
  highlightedPoints: z.array(z.string().min(1)).min(1),
});
export type DisputeEmailSchemaType = z.infer<typeof DisputeEmailSchema>;

export const DisputeEmailJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['to', 'cc', 'subject', 'body', 'highlightedPoints'],
  properties: {
    to: { type: 'string' },
    cc: { type: 'array', items: { type: 'string' } },
    subject: { type: 'string' },
    body: { type: 'string' },
    highlightedPoints: { type: 'array', items: { type: 'string' } },
  },
} as const;
