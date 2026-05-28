/* =============================================================================
 * EnvCfoContextService — adapter del puerto `ICfoContextService` que lee el
 * costo de capital y la posición de caja desde variables de entorno.
 *
 * Esto sirve como bootstrap MVP. Cuando el módulo CFO Cash Flow Forecast esté
 * implementado, reemplazar por un adapter que consulte el agregado real.
 *
 * Variables de entorno:
 *   CFO_COST_OF_CAPITAL    (default 0.08, debe estar en 0..1)
 *   CFO_CASH_POSITION      (HEALTHY | TIGHT | STRESSED, default HEALTHY)
 * ============================================================================= */

import type {
  CfoContext,
  ICfoContextService,
} from '@budget-audit/domain';

const DEFAULT_COC = 0.08;
const DEFAULT_CASH: CfoContext['cashPosition'] = 'HEALTHY';

export class EnvCfoContextService implements ICfoContextService {
  async current(_tenantId: string): Promise<CfoContext> {
    const cocRaw = process.env['CFO_COST_OF_CAPITAL'];
    const cashRaw = process.env['CFO_CASH_POSITION'];

    const coc = parseCoc(cocRaw);
    const cashPosition = parseCash(cashRaw);

    return { costOfCapital: coc, cashPosition };
  }
}

function parseCoc(raw: string | undefined): number {
  if (!raw) return DEFAULT_COC;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0 || n > 1) return DEFAULT_COC;
  return n;
}

function parseCash(raw: string | undefined): CfoContext['cashPosition'] {
  if (raw === 'HEALTHY' || raw === 'TIGHT' || raw === 'STRESSED') return raw;
  return DEFAULT_CASH;
}
