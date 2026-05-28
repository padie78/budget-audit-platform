import {
  Money,
  Supplier,
  SmartThresholds,
  ThresholdPolicy,
  type ISupplierRepository,
  type SupplierContactInfo,
} from '@budget-audit/domain';
import type {
  CreateSupplierInputDto,
  SmartThresholdsDto,
  SupplierContactInfoDto,
  ThresholdPolicyDto,
} from '@budget-audit/common';
import type { IIdGenerator } from '../../ports/id-generator.port';
import type { ILogger } from '../../ports/logger.port';

/* =============================================================================
 * CreateSupplierUseCase — agrega un nuevo proveedor al catálogo (Portal de
 * Proveedores).
 *
 * Reglas:
 *   • `name`, `taxId`, `contactEmail` son obligatorios (validados también por
 *     el Aggregate Root al crear).
 *   • El id se genera vía `IIdGenerator` (UUID en infra real).
 *   • `thresholdPolicy` y `smartThresholds` son opcionales: si no vienen, se
 *     usa una política default sin tolerancia.
 * ============================================================================= */

export interface CreateSupplierDeps {
  supplierRepository: ISupplierRepository;
  idGenerator: IIdGenerator;
  logger: ILogger;
}

export class CreateSupplierUseCase {
  constructor(private readonly deps: CreateSupplierDeps) {}

  async execute(input: CreateSupplierInputDto): Promise<Supplier> {
    this.assertRequired(input);

    const now = new Date();
    const supplier = Supplier.create({
      id: this.deps.idGenerator.generate(),
      name: input.name.trim(),
      taxId: input.taxId.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      fidelityScore: input.fidelityScore ?? 80,
      thresholdPolicy: this.buildPolicy(input.thresholdPolicy),
      contactInfo: this.buildContactInfo(input.contactInfo),
      smartThresholds: this.buildSmartThresholds(input.smartThresholds),
      createdAt: now,
      updatedAt: now,
    });

    await this.deps.supplierRepository.save(supplier);
    this.deps.logger.info('[CreateSupplier] proveedor creado', {
      supplierId: supplier.id,
      name: supplier.name,
    });

    return supplier;
  }

  private assertRequired(input: CreateSupplierInputDto): void {
    if (!input.name?.trim()) throw new Error('El nombre es obligatorio.');
    if (!input.taxId?.trim()) throw new Error('El CUIT/Tax ID es obligatorio.');
    if (!input.contactEmail?.trim()) {
      throw new Error('El email de contacto es obligatorio.');
    }
  }

  private buildPolicy(p?: ThresholdPolicyDto): ThresholdPolicy {
    if (!p) return ThresholdPolicy.default('USD');
    const currency = p.currency ?? 'USD';
    return ThresholdPolicy.of({
      percentTolerance: p.percentTolerance,
      absoluteTolerance:
        p.absoluteTolerance !== null && p.absoluteTolerance !== undefined
          ? Money.from(p.absoluteTolerance, currency)
          : null,
      autoApprovalUpTo:
        p.autoApprovalUpTo !== null && p.autoApprovalUpTo !== undefined
          ? Money.from(p.autoApprovalUpTo, currency)
          : null,
    });
  }

  private buildContactInfo(
    c?: SupplierContactInfoDto,
  ): SupplierContactInfo | undefined {
    if (!c) return undefined;
    return { email: c.email, phone: c.phone, address: c.address };
  }

  private buildSmartThresholds(
    s?: SmartThresholdsDto,
  ): SmartThresholds | undefined {
    if (!s) return undefined;
    return SmartThresholds.fromRecord(
      s.defaultTolerancePercentage,
      s.categories,
    );
  }
}
