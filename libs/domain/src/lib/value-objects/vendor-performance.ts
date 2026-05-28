/* =============================================================================
 * Vendor Performance — métricas históricas operacionales del proveedor.
 * Alimenta dashboards de sourcing y de finanzas.
 * ============================================================================= */

export type VendorTrend = 'IMPROVING' | 'STABLE' | 'DEGRADING';

/** Etapa del ciclo de vida operacional del proveedor en la plataforma. */
export type OnboardingStatus =
  | 'PENDING_FIRST_INVOICE'
  | 'ACTIVE'
  | 'OFFBOARDING'
  | 'ARCHIVED';

export interface VendorPerformanceProps {
  /** 0..1, % de docs auditados sin disputa. */
  reliabilityScore: number;
  totalAuditedDocs: number;
  totalDisputesRaised: number;
  averageDisputeResolutionDays: number;
  /** 0..1, % de entregas a tiempo según SLA. */
  slaDeliveryComplianceRate: number;
  trend: VendorTrend;
  /**
   * Onboarding lifecycle. Default `PENDING_FIRST_INVOICE` para suppliers
   * recién creados; pasa a `ACTIVE` con la primera auditoría exitosa.
   */
  onboardingStatus?: OnboardingStatus;
}

export class VendorPerformance {
  private constructor(private readonly props: VendorPerformanceProps) {}

  static of(props: VendorPerformanceProps): VendorPerformance {
    if (props.reliabilityScore < 0 || props.reliabilityScore > 1) {
      throw new Error(
        `reliabilityScore fuera de rango 0..1: ${props.reliabilityScore}`,
      );
    }
    if (
      props.slaDeliveryComplianceRate < 0 ||
      props.slaDeliveryComplianceRate > 1
    ) {
      throw new Error(
        `slaDeliveryComplianceRate fuera de rango 0..1: ${props.slaDeliveryComplianceRate}`,
      );
    }
    if (props.totalAuditedDocs < 0 || props.totalDisputesRaised < 0) {
      throw new Error('Conteos negativos no son válidos en VendorPerformance.');
    }
    return new VendorPerformance({
      ...props,
      onboardingStatus: props.onboardingStatus ?? 'PENDING_FIRST_INVOICE',
    });
  }

  get reliabilityScore(): number { return this.props.reliabilityScore; }
  get totalAuditedDocs(): number { return this.props.totalAuditedDocs; }
  get totalDisputesRaised(): number { return this.props.totalDisputesRaised; }
  get averageDisputeResolutionDays(): number {
    return this.props.averageDisputeResolutionDays;
  }
  get slaDeliveryComplianceRate(): number {
    return this.props.slaDeliveryComplianceRate;
  }
  get trend(): VendorTrend { return this.props.trend; }
  get onboardingStatus(): OnboardingStatus {
    return this.props.onboardingStatus ?? 'PENDING_FIRST_INVOICE';
  }

  /** Ratio disputas/auditados — útil para alertar al sourcing. */
  get disputeRate(): number {
    if (this.props.totalAuditedDocs === 0) return 0;
    return this.props.totalDisputesRaised / this.props.totalAuditedDocs;
  }
}
