import type { SupplierDto } from '@budget-audit/common';

/* =============================================================================
 * Supplier view models — proyecciones específicas para el Portal de Proveedores.
 * Aíslan al UI del shape exacto del DTO y formatean valores para tablas/forms.
 * ============================================================================= */

export interface SupplierRowVm {
  id: string;
  entityId: string;
  name: string;
  taxId: string;
  contactEmail: string;
  fidelityScore: number;
  tolerancePercent: number;
  currency: string;
  autoApprovalUpTo: number | null;

  /** Etiqueta cualitativa: 'LOW' | 'MEDIUM' | ... */
  riskLevel?: string;
  /** 'IMPROVING' | 'STABLE' | 'DEGRADING' */
  trend?: string;
  /** 'LOW' | 'MEDIUM' | 'HIGH' | 'STRATEGIC' */
  criticality?: string;

  // ─────────── Compliance & ESG ───────────
  status?: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'INACTIVE';
  onboardingStatus?:
    | 'PENDING_FIRST_INVOICE'
    | 'ACTIVE'
    | 'OFFBOARDING'
    | 'ARCHIVED';
  primarySectorCode?: string;
  esgComplianceScore?: number;
  certifications?: string[];

  updatedAt: string;
}

export function toSupplierRowVm(dto: SupplierDto): SupplierRowVm {
  return {
    id: dto.id,
    entityId: dto.entityId,
    name: dto.name,
    taxId: dto.taxId,
    contactEmail: dto.contactEmail,
    fidelityScore: dto.fidelityScore,
    tolerancePercent: dto.thresholdPolicy.percentTolerance,
    currency: dto.thresholdPolicy.currency,
    autoApprovalUpTo: dto.thresholdPolicy.autoApprovalUpTo,
    riskLevel: dto.strategicIntelligence?.riskProfile.level,
    trend: dto.vendorPerformance?.trend,
    criticality: dto.strategicIntelligence?.criticalityIndex,
    status: dto.complianceAndRisk?.status,
    onboardingStatus: dto.vendorPerformance?.onboardingStatus,
    primarySectorCode: dto.complianceAndRisk?.primarySectorCode,
    esgComplianceScore: dto.complianceAndRisk?.esgComplianceScore,
    certifications: dto.complianceAndRisk?.certifications,
    updatedAt: dto.updatedAt,
  };
}
