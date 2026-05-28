/* =============================================================================
 * Supplier Intelligence — tipos compartidos del read-model de eventos.
 *
 * Estos shapes representan agregados que las calculadoras consumen.
 * Son DTOs internos del bounded context — no se exponen como API pública.
 * ============================================================================= */

/** Una auditoría completada/disputada. Sólo los campos que las fórmulas necesitan. */
export interface AuditEvent {
  auditedAt: Date;
  /** Categoría operacional del gasto (RAW_MATERIALS, LOGISTICS, ...). */
  category: string | null;
  /** |deviation| en porcentaje del monto contratado, 0..N. */
  deviationPercent: number;
  hasDispute: boolean;
  /** Días de retraso de entrega vs SLA. 0 = a tiempo, >0 = late. */
  slaDeviationDays: number;
}

/** Disputa abierta o cerrada — alimenta `average_dispute_resolution_days`. */
export interface DisputeEvent {
  raisedAt: Date;
  resolvedAt: Date | null;
  /** Monto reclamado en moneda del contrato. */
  amount: number;
}

/** Resultado pre-agregado de un período (típicamente 30 días). */
export interface PerformanceWindow {
  /** Inicio de la ventana (exclusivo del fin de la anterior). */
  start: Date;
  /** Fin de la ventana. */
  end: Date;
  /** reliabilityScore calculado para esa ventana, 0..1. */
  reliabilityScore: number;
  auditedDocs: number;
  disputesRaised: number;
}

/** Señal externa cruda (sanciones, prensa adversa). */
export interface ExternalRiskSignal {
  source: string;
  observedAt: Date;
  /** 0..1, severidad de la señal. */
  severity: number;
  description?: string;
}

/** Contexto financiero del tenant para fórmulas de pago. */
export interface CfoContext {
  /** Costo de capital anual del tenant, 0..1 (0.08 = 8%). */
  costOfCapital: number;
  /** Estado de caja: HEALTHY | TIGHT | STRESSED. */
  cashPosition: 'HEALTHY' | 'TIGHT' | 'STRESSED';
}

/** Certificación extraída de un documento. */
export interface ExtractedCertification {
  name: string;
  issuer: string;
  validFrom: Date | null;
  validUntil: Date | null;
  /** Confianza del modelo, 0..1. */
  confidence: number;
}
