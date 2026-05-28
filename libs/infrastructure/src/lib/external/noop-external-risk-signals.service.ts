/* =============================================================================
 * NoopExternalRiskSignalsService — implementación neutra del puerto.
 *
 * MVP: devuelve siempre una lista vacía → `risk.external` component queda en 0.
 * Próximo paso: integrar OFAC, listas de sanciones y un screening de noticias
 * vía LLM/API externa.
 * ============================================================================= */

import type {
  ExternalRiskSignal,
  IExternalRiskSignalsService,
} from '@budget-audit/domain';

export class NoopExternalRiskSignalsService
  implements IExternalRiskSignalsService
{
  async fetch(
    _tenantId: string,
    _supplierId: string,
  ): Promise<ExternalRiskSignal[]> {
    return [];
  }
}
