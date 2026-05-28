/**
 * Identificadores discriminantes para cada tipo de ítem persistido en la
 * tabla única (Single-Table Design). Se almacenan en el atributo `entityType`
 * de cada item para facilitar el polimorfismo en queries y en streams.
 */
export const EntityType = {
  Supplier: 'SUPPLIER',
  Contract: 'CONTRACT',
  BudgetAudit: 'BUDGET_AUDIT',
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

/**
 * Estados de la auditoría utilizados también como discriminante en el GSI1
 * para listar las auditorías por estado ordenadas temporalmente.
 */
export const AuditStatus = {
  Pending: 'PENDING',
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
} as const;

export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];
