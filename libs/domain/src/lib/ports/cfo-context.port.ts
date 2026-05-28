import type { CfoContext } from '../services/supplier-intelligence/types';

/**
 * Puerto al módulo CFO Cash Flow Forecast: provee el costo de capital del
 * tenant y la posición de caja. Drives `payment_strategy`.
 */
export interface ICfoContextService {
  current(tenantId: string): Promise<CfoContext>;
}

export const CFO_CONTEXT_SERVICE = Symbol('ICfoContextService');
