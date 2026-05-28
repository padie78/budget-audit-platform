import {
  Money,
  PaymentStrategy,
  RiskProfile,
  SmartThresholds,
  StrategicIntelligence,
  Supplier,
  SupplierNotFoundError,
  ThresholdPolicy,
  VendorPerformance,
  type ISupplierRepository,
  type SupplierContactInfo,
} from '@budget-audit/domain';
import type {
  SmartThresholdsDto,
  StrategicIntelligenceDto,
  SupplierContactInfoDto,
  ThresholdPolicyDto,
  UpdateSupplierInputDto,
  VendorPerformanceDto,
} from '@budget-audit/common';
import type { ILogger } from '../../ports/logger.port';

/* =============================================================================
 * UpdateSupplierUseCase — patch parcial.
 *
 * Hace merge: solo aplica los campos definidos en el input; el resto preserva
 * el snapshot existente. Incrementa `versionId` para alinear con el OCC del
 * design canónico.
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
      entityId: input.entityId?.trim() || snap.entityId,
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
      strategicIntelligence: input.strategicIntelligence
        ? this.buildStrategicIntelligence(input.strategicIntelligence)
        : snap.strategicIntelligence,
      vendorPerformance: input.vendorPerformance
        ? this.buildVendorPerformance(input.vendorPerformance)
        : snap.vendorPerformance,
      versionId: (snap.versionId ?? 1) + 1,
      createdAt: snap.createdAt,
      updatedAt: new Date(),
    });

    await this.deps.supplierRepository.save(merged);
    this.deps.logger.info('[UpdateSupplier] proveedor actualizado', {
      tenantId: merged.tenantId,
      supplierId: merged.id,
      versionId: merged.versionId,
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

  private buildStrategicIntelligence(
    s: StrategicIntelligenceDto,
  ): StrategicIntelligence {
    return StrategicIntelligence.of({
      riskProfile: RiskProfile.of({
        score: s.riskProfile.score,
        level: s.riskProfile.level,
        lastCheck: new Date(s.riskProfile.lastCheck),
      }),
      paymentStrategy: PaymentStrategy.of({
        earlyPaymentPreferred: s.paymentStrategy.earlyPaymentPreferred,
        discountTargetPercentage: s.paymentStrategy.discountTargetPercentage,
      }),
      diversityStatus: [...s.diversityStatus],
      criticalityIndex: s.criticalityIndex,
    });
  }

  private buildVendorPerformance(v: VendorPerformanceDto): VendorPerformance {
    return VendorPerformance.of(v);
  }
}
