import type {
  AuditEvent,
  PerformanceWindow,
} from '../services/supplier-intelligence/types';

/**
 * Read-model del historial de auditorías de un supplier.
 * Lo implementa el adapter de DynamoDB que recorre los items AUDIT#... bajo
 * el supplier (o un GSI por status).
 */
export interface IAuditHistoryReadModel {
  /** Recupera N eventos recientes, ordenados desc por fecha. */
  listRecent(
    tenantId: string,
    supplierId: string,
    limit?: number,
  ): Promise<AuditEvent[]>;

  /**
   * Devuelve ventanas pre-agregadas para tendencia. Default: 3 ventanas de
   * 30 días. El adapter es libre de calcularlas on-the-fly o leer de un GSI.
   */
  listPerformanceWindows(
    tenantId: string,
    supplierId: string,
    windowCount?: number,
    windowSizeDays?: number,
  ): Promise<PerformanceWindow[]>;

  /**
   * % del spend total del tenant que concentra este supplier en los últimos
   * 12 meses. 0..1. Drives `risk.concentration`.
   */
  spendConcentration(tenantId: string, supplierId: string): Promise<number>;
}

export const AUDIT_HISTORY_READ_MODEL = Symbol('IAuditHistoryReadModel');
