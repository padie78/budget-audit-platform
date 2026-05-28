import type { ISupplierRepository } from '@budget-audit/domain';
import type { DeleteSupplierResultDto } from '@budget-audit/common';
import type { ILogger } from '../../ports/logger.port';

/* =============================================================================
 * DeleteSupplierUseCase — borrado idempotente del proveedor (METADATA).
 *
 * Nota: NO borra en cascada los contratos ni auditorías asociadas. Para una
 * versión enterprise conviene un workflow de "soft delete" + job que limpie
 * dependencias. Por ahora, hard delete del item METADATA del proveedor.
 * ============================================================================= */

export interface DeleteSupplierDeps {
  supplierRepository: ISupplierRepository;
  logger: ILogger;
}

export class DeleteSupplierUseCase {
  constructor(private readonly deps: DeleteSupplierDeps) {}

  async execute(
    tenantId: string,
    supplierId: string,
  ): Promise<DeleteSupplierResultDto> {
    if (!tenantId?.trim()) throw new Error('tenantId es obligatorio.');
    if (!supplierId?.trim()) {
      throw new Error('supplierId es obligatorio para borrar.');
    }
    await this.deps.supplierRepository.delete(tenantId, supplierId);
    this.deps.logger.info('[DeleteSupplier] proveedor eliminado', {
      tenantId,
      supplierId,
    });
    return { tenantId, id: supplierId, deleted: true };
  }
}
