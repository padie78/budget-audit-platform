import { z } from 'zod';

/**
 * JSON Schema (vía Zod) que se envía al LLM como Structured Output. El
 * proveedor (OpenAI o Bedrock) garantiza que la respuesta cumpla este
 * schema. Esto elimina el parsing frágil y nos da type-safety end-to-end.
 */
export const ExtractedBudgetItemSchema = z.object({
  sku: z.string().describe('Código o SKU del ítem en el catálogo del proveedor'),
  description: z.string(),
  unit: z.string().describe('Unidad de medida (ej. UN, KG, HR)'),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
});

export const ExtractedBudgetSchema = z.object({
  supplierName: z.string(),
  quoteNumber: z.string().nullable(),
  currency: z.string().length(3).describe('Código ISO 4217 (ej. USD, ARS)'),
  issuedAt: z.string().nullable().describe('Fecha ISO 8601'),
  items: z.array(ExtractedBudgetItemSchema).min(1),
  totalAmount: z.number().nonnegative(),
});

export type ExtractedBudgetSchemaType = z.infer<typeof ExtractedBudgetSchema>;

/**
 * JSON Schema crudo (Draft-07 compatible con OpenAI/Bedrock structured outputs).
 * Se mantiene en sincronía con el schema Zod mediante tests dedicados.
 */
export const ExtractedBudgetJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'supplierName',
    'quoteNumber',
    'currency',
    'issuedAt',
    'items',
    'totalAmount',
  ],
  properties: {
    supplierName: { type: 'string' },
    quoteNumber: { type: ['string', 'null'] },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    issuedAt: { type: ['string', 'null'] },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'sku',
          'description',
          'unit',
          'quantity',
          'unitPrice',
          'lineTotal',
        ],
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
    totalAmount: { type: 'number' },
  },
} as const;
