import type { DisputeEvent } from '../services/supplier-intelligence/types';

/**
 * Read-model del historial de disputas — alimenta
 * `vendor_performance.average_dispute_resolution_days`.
 */
export interface IDisputeHistoryReadModel {
  listRecent(
    tenantId: string,
    supplierId: string,
    limit?: number,
  ): Promise<DisputeEvent[]>;

  /** Promedio de días entre raised y resolved para las disputas cerradas. */
  averageResolutionDays(
    tenantId: string,
    supplierId: string,
  ): Promise<number>;
}

export const DISPUTE_HISTORY_READ_MODEL = Symbol('IDisputeHistoryReadModel');
