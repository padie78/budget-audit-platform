import { Money } from './money';
import { AlertSeverity } from './alert-severity';

export const MatchStatus = {
  Matched: 'MATCHED',
  PriceMismatch: 'PRICE_MISMATCH',
  QuantityMismatch: 'QUANTITY_MISMATCH',
  MissingInPo: 'MISSING_IN_PO',
  MissingInInvoice: 'MISSING_IN_INVOICE',
  MissingInContract: 'MISSING_IN_CONTRACT',
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

/**
 * Una línea de la conciliación de 3 vías:
 *   Contrato Base ⟷ Orden de Compra ⟷ Factura
 *
 * Para cada SKU se cruzan precios y cantidades. El status indica si todas
 * las dimensiones cuadran o cuál es la inconsistencia. Esto habilita el
 * bloqueo automático de pagos en el ERP cuando algo no cierra.
 */
export interface ThreeWayMatchLine {
  sku: string;
  description: string;

  contractPrice: Money | null;
  poPrice: Money | null;
  invoicePrice: Money | null;

  poQuantity: number | null;
  invoiceQuantity: number | null;

  status: MatchStatus;
  severity: AlertSeverity;
  notes: string;
}

export interface ThreeWayMatchResult {
  lines: ThreeWayMatchLine[];
  matchedCount: number;
  mismatchedCount: number;
  totalAuthorized: Money;
  totalInvoiced: Money;
  /** Diferencia financiera total Invoice - PO. Positivo = sobrepagar. */
  paymentExposure: Money;
}
