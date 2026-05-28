import {
  Money,
  Supplier,
  SmartThresholds,
  SupplierNotFoundError,
  ThresholdPolicy,
  type ISupplierRepository,
  type SupplierContactInfo,
} from '@budget-audit/domain';
import type {
  SmartThresholdsDto,
  SupplierContactInfoDto,
  ThresholdPolicyDto,
  UpdateSupplierInputDto,
} from '@budget-audit/common';
import type { ILogger } from '../../ports/logger.port';

/* =============================================================================
 * UpdateSupplierUseCase — patch parcial de un proveedor existente.
 *
 * Todos los campos del input (excepto `id`) son opcionales: solo se aplican
 * los que vienen definidos, mediante "merge" sobre el snapshot actual.
 * ============================================================================= */

export interface UpdateSupplierDeps {
  supplierRepository: ISupplierRepository;
  logger: ILogger;
}

export class UpdateSupplierUseCase {
  constructor(private readonly deps: UpdateSupplierDeps) {}

  async execute(input: UpdateSupplierInputDto): Promise<Supplier> {
    if (!input.tenantId?.trim()) {
      throw new Error('tenantId es obligatorio.');
    }
    const existing = await this.deps.supplierRepository.findById(
      input.tenantId,
      input.id,
    );
    if (!existing) throw new SupplierNotFoundError(input.id);

    const snap = existing.toJSON();
    const merged = Supplier.create({
      tenantId: snap.tenantId,
      id: snap.id,
      name: input.name?.trim() ?? snap.name,
      taxId: input.taxId?.trim() ?? snap.taxId,
      contactEmail:
        input.contactEmail?.trim().toLowerCase() ?? snap.contactEmail,
      fidelityScore: input.fidelityScore ?? snap.fidelityScore,
      thresholdPolicy: input.thresholdPolicy
        ? this.buildPolicy(input.thresholdPolicy)
        : snap.thresholdPolicy,
      contactInfo: input.contactInfo
        ? this.buildContactInfo(input.contactInfo)
        : snap.contactInfo,
      smartThresholds: input.smartThresholds
        ? this.buildSmartThresholds(input.smartThresholds)
        : snap.smartThresholds,
      strategicIntelligence: snap.strategicIntelligence,
      vendorPerformance: snap.vendorPerformance,
      createdAt: snap.createdAt,
      updatedAt: new Date(),
    });

    await this.deps.supplierRepository.save(merged);
    this.deps.logger.info('[UpdateSupplier] proveedor actualizado', {
      supplierId: merged.id,
    });
    return merged;
  }

  private buildPolicy(p: ThresholdPolicyDto): ThresholdPolicy {
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

  private buildContactInfo(c: SupplierContactInfoDto): SupplierContactInfo {
    return { email: c.email, phone: c.phone, address: c.address };
  }

  private buildSmartThresholds(s: SmartThresholdsDto): SmartThresholds {
    return SmartThresholds.fromRecord(
      s.defaultTolerancePercentage,
      s.categories,
    );
  }
}
