import type { SupplierDto } from '@budget-audit/common';

/* =============================================================================
 * Supplier view models — proyecciones específicas para el Portal de Proveedores.
 * Aíslan al UI del shape exacto del DTO y formatean valores para tablas/forms.
 * ============================================================================= */

export interface SupplierRowVm {
  id: string;
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

  updatedAt: string;
}

export function toSupplierRowVm(dto: SupplierDto): SupplierRowVm {
  return {
    id: dto.id,
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
    updatedAt: dto.updatedAt,
  };
}
