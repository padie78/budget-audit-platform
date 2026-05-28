import {
  Money,
  AlertSeverity,
  type ExtractedBudget,
  type Contract,
  type ThreeWayMatchLine,
  type ThreeWayMatchResult,
  MatchStatus,
} from '@budget-audit/domain';

/**
 * Three-Way Matcher matemático: cruza Contrato Base, Orden de Compra y
 * Factura por SKU. Cada línea reporta status individual y el resultado
 * global expone el "payment exposure" (diferencia financiera total).
 */
export function computeThreeWayMatch(input: {
  contract: Contract | null;
  purchaseOrder: ExtractedBudget | null;
  invoice: ExtractedBudget;
  currency: string;
}): ThreeWayMatchResult {
  const { contract, purchaseOrder, invoice, currency } = input;
  const lines: ThreeWayMatchLine[] = [];

  const skus = new Set<string>();
  invoice.items.forEach((i) => skus.add(i.sku));
  purchaseOrder?.items.forEach((i) => skus.add(i.sku));
  contract?.agreedItems.forEach((_v, k) => skus.add(k));

  let totalAuthorized = Money.zero(currency);
  let totalInvoiced = Money.zero(currency);

  for (const sku of skus) {
    const agreed = contract?.findAgreedItem(sku);
    const po = purchaseOrder?.items.find((i) => i.sku === sku);
    const inv = invoice.items.find((i) => i.sku === sku);

    const description = inv?.description ?? po?.description ?? agreed?.description ?? sku;

    const contractPrice = agreed?.agreedUnitPrice ?? null;
    const poPrice = po?.unitPrice ?? null;
    const invoicePrice = inv?.unitPrice ?? null;
    const poQty = po?.quantity ?? null;
    const invQty = inv?.quantity ?? null;

    if (po) totalAuthorized = totalAuthorized.add(po.lineTotal);
    if (inv) totalInvoiced = totalInvoiced.add(inv.lineTotal);

    const status = decideStatus({
      hasContract: !!agreed,
      hasPo: !!po,
      hasInvoice: !!inv,
      contractPrice,
      poPrice,
      invoicePrice,
      poQty,
      invQty,
    });

    const severity =
      status === MatchStatus.Matched ? AlertSeverity.Green : AlertSeverity.Red;

    lines.push({
      sku,
      description,
      contractPrice,
      poPrice,
      invoicePrice,
      poQuantity: poQty,
      invoiceQuantity: invQty,
      status,
      severity,
      notes: notesFor(status),
    });
  }

  const matchedCount = lines.filter((l) => l.status === MatchStatus.Matched).length;
  const mismatchedCount = lines.length - matchedCount;
  const paymentExposure = totalInvoiced.subtract(totalAuthorized);

  return {
    lines,
    matchedCount,
    mismatchedCount,
    totalAuthorized,
    totalInvoiced,
    paymentExposure,
  };
}

function decideStatus(params: {
  hasContract: boolean;
  hasPo: boolean;
  hasInvoice: boolean;
  contractPrice: Money | null;
  poPrice: Money | null;
  invoicePrice: Money | null;
  poQty: number | null;
  invQty: number | null;
}): MatchStatus {
  if (!params.hasContract) return MatchStatus.MissingInContract;
  if (!params.hasPo) return MatchStatus.MissingInPo;
  if (!params.hasInvoice) return MatchStatus.MissingInInvoice;

  const priceMismatch =
    params.poPrice && params.invoicePrice && params.poPrice.amount !== params.invoicePrice.amount;
  if (priceMismatch) return MatchStatus.PriceMismatch;

  const qtyMismatch = params.poQty !== null && params.invQty !== null && params.poQty !== params.invQty;
  if (qtyMismatch) return MatchStatus.QuantityMismatch;

  return MatchStatus.Matched;
}

function notesFor(status: MatchStatus): string {
  switch (status) {
    case MatchStatus.Matched:
      return 'Contrato, OC y Factura coinciden.';
    case MatchStatus.PriceMismatch:
      return 'El precio facturado difiere del autorizado en la OC.';
    case MatchStatus.QuantityMismatch:
      return 'Cantidad facturada distinta a la autorizada en la OC.';
    case MatchStatus.MissingInPo:
      return 'Ítem facturado pero no autorizado por una OC.';
    case MatchStatus.MissingInInvoice:
      return 'Ítem autorizado en la OC pero no aparece en la factura.';
    case MatchStatus.MissingInContract:
      return 'Ítem facturado sin estar en el contrato línea base.';
  }
}
