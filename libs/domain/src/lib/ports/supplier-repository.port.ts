import type { Supplier } from '../entities/supplier';

/* =============================================================================
 * ISupplierRepository — puerto del agregado Supplier (multitenant).
 *
 * Cada operación está scopeada por `tenantId`. La implementación concreta
 * construye las DynamoDB keys con prefijo `TENANT#<t>#SUPPLIER#<s>` para
 * garantizar aislamiento físico entre tenants.
 * ============================================================================= */
export interface ISupplierRepository {
  findById(tenantId: string, supplierId: string): Promise<Supplier | null>;

  /** Persiste un Supplier (insert o replace por PK/SK). */
  save(supplier: Supplier): Promise<void>;

  /** Elimina por (tenantId, supplierId). Idempotente. */
  delete(tenantId: string, supplierId: string): Promise<void>;

  /**
   * Lista los suppliers del tenant. MVP usa scan con `begins_with(PK, ...)`
   * más filter `SK = METADATA`; a escala migrar a GSI dedicado por tenant.
   */
  listAll(tenantId: string, limit?: number): Promise<Supplier[]>;
}

export const SUPPLIER_REPOSITORY = Symbol('ISupplierRepository');
