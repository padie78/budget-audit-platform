import type { Supplier } from '../entities/supplier';

/* =============================================================================
 * ISupplierRepository — puerto del agregado Supplier.
 *
 * Define el contrato CRUD + listado paginado que cualquier infraestructura
 * concreta (DynamoDB, in-memory para tests, etc.) debe implementar.
 *
 * Las operaciones lanzan errores de dominio (`SupplierNotFoundError`) cuando
 * corresponde, en vez de devolver `null` para los caminos de error críticos
 * (update/delete sobre id inexistente).
 * ============================================================================= */
export interface ISupplierRepository {
  findById(supplierId: string): Promise<Supplier | null>;

  /** Persiste un Supplier (insert o replace por PK/SK). */
  save(supplier: Supplier): Promise<void>;

  /** Elimina por id. No falla si no existe (idempotente). */
  delete(supplierId: string): Promise<void>;

  /**
   * Devuelve todos los suppliers del sistema. Para MVP usa scan con filter
   * sobre `SK = METADATA`; cuando el catálogo escale, conviene mover esto a
   * un GSI dedicado.
   */
  listAll(limit?: number): Promise<Supplier[]>;
}

export const SUPPLIER_REPOSITORY = Symbol('ISupplierRepository');
