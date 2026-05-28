import {
  Supplier,
  type StrategicIntelligence,
  type VendorPerformance,
  type SmartThresholds,
  type SupplierContactInfo,
} from '@budget-audit/domain';
import type {
  StrategicIntelligenceDto,
  SupplierContactInfoDto,
  SupplierDto,
  VendorPerformanceDto,
  SmartThresholdsDto,
} from '@budget-audit/common';

/* =============================================================================
 * SupplierMapper — Domain → DTO. Aísla la serialización del aggregate root.
 * ============================================================================= */
export class SupplierMapper {
  static toDto(supplier: Supplier): SupplierDto {
    const snap = supplier.toJSON();
    const policy = snap.thresholdPolicy;
    const currency =
      policy.absolute?.currency ??
      policy.autoApprovalLimit?.currency ??
      'USD';

    return {
      id: snap.id,
      name: snap.name,
      taxId: snap.taxId,
      contactEmail: snap.contactEmail,
      fidelityScore: snap.fidelityScore,
      thresholdPolicy: {
        percentTolerance: policy.percent,
        absoluteTolerance: policy.absolute?.amount ?? null,
        autoApprovalUpTo: policy.autoApprovalLimit?.amount ?? null,
        currency,
      },
      createdAt: snap.createdAt.toISOString(),
      updatedAt: snap.updatedAt.toISOString(),

      contactInfo: snap.contactInfo
        ? SupplierMapper.contactInfoToDto(snap.contactInfo)
        : undefined,
      strategicIntelligence: snap.strategicIntelligence
        ? SupplierMapper.strategicIntelligenceToDto(snap.strategicIntelligence)
        : undefined,
      vendorPerformance: snap.vendorPerformance
        ? SupplierMapper.vendorPerformanceToDto(snap.vendorPerformance)
        : undefined,
      smartThresholds: snap.smartThresholds
        ? SupplierMapper.smartThresholdsToDto(snap.smartThresholds)
        : undefined,
    };
  }

  private static contactInfoToDto(c: SupplierContactInfo): SupplierContactInfoDto {
    return { email: c.email, phone: c.phone, address: c.address };
  }

  private static strategicIntelligenceToDto(
    s: StrategicIntelligence,
  ): StrategicIntelligenceDto {
    return {
      riskProfile: {
        score: s.riskProfile.score,
        level: s.riskProfile.level,
        lastCheck: s.riskProfile.lastCheck.toISOString().slice(0, 10),
      },
      paymentStrategy: {
        earlyPaymentPreferred: s.paymentStrategy.earlyPaymentPreferred,
        discountTargetPercentage: s.paymentStrategy.discountTargetPercentage,
      },
      diversityStatus: [...s.diversityStatus],
      criticalityIndex: s.criticalityIndex,
    };
  }

  private static vendorPerformanceToDto(
    v: VendorPerformance,
  ): VendorPerformanceDto {
    return {
      reliabilityScore: v.reliabilityScore,
      totalAuditedDocs: v.totalAuditedDocs,
      totalDisputesRaised: v.totalDisputesRaised,
      averageDisputeResolutionDays: v.averageDisputeResolutionDays,
      slaDeliveryComplianceRate: v.slaDeliveryComplianceRate,
      trend: v.trend,
    };
  }

  private static smartThresholdsToDto(
    s: SmartThresholds,
  ): SmartThresholdsDto {
    const categories: Record<string, number> = {};
    for (const [cat, value] of s.categories.entries()) {
      categories[cat] = value;
    }
    return {
      defaultTolerancePercentage: s.defaultTolerancePercentage,
      categories,
    };
  }
}
