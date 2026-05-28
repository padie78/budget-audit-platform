import type { Budget } from '../entities/budget';

/**
 * Puerto para notificar el resultado final de una auditoría. La
 * implementación típica publica el evento en AppSync (vía mutation interna)
 * para que la subscription `onAuditCompleted` despierte al frontend.
 */
export interface IAuditEventPublisher {
  publishAuditCompleted(budget: Budget): Promise<void>;
  publishAuditFailed(budget: Budget): Promise<void>;
}

export const AUDIT_EVENT_PUBLISHER = Symbol('IAuditEventPublisher');
