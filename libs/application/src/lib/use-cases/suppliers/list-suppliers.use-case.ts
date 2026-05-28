import type { ISupplierRepository, Supplier } from '@budget-audit/domain';

/* =============================================================================
 * ListSuppliersUseCase — devuelve todos los proveedores del catálogo.
 *
 * Para MVP usa el `listAll` del repo (scan con filter por SK = METADATA).
 * En producción reemplazar el `listAll` por un GSI dedicado para no escanear
 * la tabla completa.
 * ============================================================================= */

export interface ListSuppliersDeps {
  supplierRepository: ISupplierRepository;
}

export class ListSuppliersUseCase {
  constructor(private readonly deps: ListSuppliersDeps) {}

  async execute(limit?: number): Promise<Supplier[]> {
    const suppliers = await this.deps.supplierRepository.listAll(limit);
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name));
  }
}
