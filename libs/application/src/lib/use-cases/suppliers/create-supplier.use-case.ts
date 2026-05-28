import {
  DEFAULT_ENTITY_ID,
  Money,
  PaymentStrategy,
  RiskProfile,
  SmartThresholds,
  StrategicIntelligence,
  Supplier,
  ThresholdPolicy,
  VendorPerformance,
  type ISupplierRepository,
  type SupplierContactInfo,
} from '@budget-audit/domain';
import type {
  CreateSupplierInputDto,
  SmartThresholdsDto,
  StrategicIntelligenceDto,
  SupplierContactInfoDto,
  ThresholdPolicyDto,
  VendorPerformanceDto,
} from '@budget-audit/common';
import type { IIdGenerator } from '../../ports/id-generator.port';
import type { ILogger } from '../../ports/logger.port';

/* =============================================================================
 * CreateSupplierUseCase — agrega un nuevo proveedor al catálogo.
 *
 * Reglas:
 *   • `tenantId`, `name`, `taxId`, `contactEmail` son obligatorios.
 *   • `entityId` (Sede) es opcional → default `GLOBAL`.
 *   • Todos los bloques estratégicos (strategicIntelligence, vendorPerformance,
 *     smartThresholds) son opcionales: si no vienen, se construyen defaults
 *     enterprise sensatos para que la grilla nunca quede vacía.
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
    const policy = this.buildPolicy(input.thresholdPolicy);
    const supplier = Supplier.create({
      tenantId: input.tenantId,
      entityId: input.entityId?.trim() || DEFAULT_ENTITY_ID,
      id: this.deps.idGenerator.generate(),
      name: input.name.trim(),
      taxId: input.taxId.trim(),
      contactEmail: input.contactEmail.trim().toLowerCase(),
      fidelityScore: input.fidelityScore ?? 80,
      thresholdPolicy: policy,
      contactInfo: this.buildContactInfo(input.contactInfo),
      strategicIntelligence: this.buildStrategicIntelligence(
        input.strategicIntelligence,
        now,
      ),
      vendorPerformance: this.buildVendorPerformance(
        input.vendorPerformance,
        input.fidelityScore ?? 80,
      ),
      smartThresholds: this.buildSmartThresholds(
        input.smartThresholds,
        policy.percent,
      ),
      versionId: 1,
      createdAt: now,
      updatedAt: now,
    });

    await this.deps.supplierRepository.save(supplier);
    this.deps.logger.info('[CreateSupplier] proveedor creado', {
      tenantId: supplier.tenantId,
      entityId: supplier.entityId,
      supplierId: supplier.id,
      name: supplier.name,
    });

    return supplier;
  }

  private assertRequired(input: CreateSupplierInputDto): void {
    if (!input.tenantId?.trim()) {
      throw new Error('tenantId es obligatorio.');
    }
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

  private buildStrategicIntelligence(
    s: StrategicIntelligenceDto | undefined,
    now: Date,
  ): StrategicIntelligence {
    const src = s ?? {
      riskProfile: {
        score: 80,
        level: 'LOW' as const,
        lastCheck: now.toISOString().slice(0, 10),
      },
      paymentStrategy: {
        earlyPaymentPreferred: false,
        discountTargetPercentage: 0,
      },
      diversityStatus: [],
      criticalityIndex: 'MEDIUM' as const,
    };
    return StrategicIntelligence.of({
      riskProfile: RiskProfile.of({
        score: src.riskProfile.score,
        level: src.riskProfile.level,
        lastCheck: new Date(src.riskProfile.lastCheck),
      }),
      paymentStrategy: PaymentStrategy.of({
        earlyPaymentPreferred: src.paymentStrategy.earlyPaymentPreferred,
        discountTargetPercentage: src.paymentStrategy.discountTargetPercentage,
      }),
      diversityStatus: [...src.diversityStatus],
      criticalityIndex: src.criticalityIndex,
    });
  }

  private buildVendorPerformance(
    v: VendorPerformanceDto | undefined,
    fallbackReliability: number,
  ): VendorPerformance {
    const src = v ?? {
      reliabilityScore: fallbackReliability / 100,
      totalAuditedDocs: 0,
      totalDisputesRaised: 0,
      averageDisputeResolutionDays: 0,
      slaDeliveryComplianceRate: 1,
      trend: 'STABLE' as const,
    };
    return VendorPerformance.of(src);
  }

  private buildSmartThresholds(
    s: SmartThresholdsDto | undefined,
    fallbackPercent: number,
  ): SmartThresholds {
    if (!s) {
      return SmartThresholds.fromRecord(fallbackPercent, {});
    }
    return SmartThresholds.fromRecord(
      s.defaultTolerancePercentage,
      s.categories,
    );
  }
}
