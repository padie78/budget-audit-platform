/* =============================================================================
 * SupplierDto — perfil core del proveedor + inteligencia estratégica.
 *
 * Mapea 1:1 con el item `SK: METADATA` de DynamoDB (ver docs/dynamodb_design.md
 * §2.1). Todos los bloques estratégicos (`strategicIntelligence`,
 * `vendorPerformance`, `smartThresholds.categories`) son OPCIONALES para no
 * romper consumidores legacy: si vienen vacíos, el UI usa los defaults.
 * ============================================================================= */

export interface ThresholdPolicyDto {
  percentTolerance: number;
  absoluteTolerance: number | null;
  autoApprovalUpTo: number | null;
  currency: string;
}

/** Score de riesgo del proveedor (gobernanza, performance, drift). */
export interface RiskProfileDto {
  /** 0..100, mayor = más sano. */
  score: number;
  /** Banding cualitativo. */
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** ISO date del último cálculo. */
  lastCheck: string;
}

/** Configuración financiera/estratégica de pagos. */
export interface PaymentStrategyDto {
  earlyPaymentPreferred: boolean;
  /** % objetivo de descuento si se paga antes (e.g. 2.0 = 2%). */
  discountTargetPercentage: number;
}

/**
 * Bloque de inteligencia estratégica (gobernanza, ESG, criticidad).
 * Drives:
 *   - Sourcing decisions (renovar contrato / cambiar de proveedor)
 *   - Workflows financieros (priorizar early-pay si discount target alto)
 *   - Reportes ESG corporativos
 */
export interface StrategicIntelligenceDto {
  riskProfile: RiskProfileDto;
  paymentStrategy: PaymentStrategyDto;
  /** Tags certificados (SUSTAINABLE_CERTIFIED, MINORITY_OWNED, etc.). */
  diversityStatus: string[];
  criticalityIndex: 'LOW' | 'MEDIUM' | 'HIGH' | 'STRATEGIC';
}

/** Performance histórica del vendor — alimenta los dashboards del CFO. */
export interface VendorPerformanceDto {
  /** 0..1, % de docs auditados sin disputa. */
  reliabilityScore: number;
  totalAuditedDocs: number;
  totalDisputesRaised: number;
  averageDisputeResolutionDays: number;
  /** 0..1, % de entregas a tiempo según SLA. */
  slaDeliveryComplianceRate: number;
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  /** Etapa del ciclo de vida operacional. */
  onboardingStatus?:
    | 'PENDING_FIRST_INVOICE'
    | 'ACTIVE'
    | 'OFFBOARDING'
    | 'ARCHIVED';
}

/**
 * Compliance & Risk — estado regulatorio, certificaciones y huella ESG.
 * Drives sourcing decisions y reportes corporativos.
 */
export interface ComplianceAndRiskDto {
  status: 'ACTIVE' | 'SUSPENDED' | 'BLOCKED' | 'INACTIVE';
  /** ISO timestamp de la última auditoría compliance/ESG/legal. */
  lastAuditDate: string;
  certifications: string[];
  /** 0..100 — score ESG compuesto. */
  esgComplianceScore: number;
  /** Categoría operacional principal (RAW_MATERIALS, LOGISTICS, ...). */
  primarySectorCode: string;
}

/**
 * Smart Thresholds extendido con tolerancias por categoría operacional.
 * `defaultTolerancePercentage` es el fallback; `categories` permite afinar por
 * tipo de gasto (e.g. RAW_MATERIALS más estricto, LOGISTICS más permisivo).
 */
export interface SmartThresholdsDto {
  /** Tolerancia % por defecto (aplica si no hay regla de categoría). */
  defaultTolerancePercentage: number;
  /** Mapa CategoryName → tolerance % (RAW_MATERIALS, LOGISTICS, etc.). */
  categories: Record<string, number>;
}

export interface SupplierContactInfoDto {
  email: string;
  phone?: string;
  address?: string;
}

/* =============================================================================
 * Inputs de mutations (ABM del Portal de Proveedores).
 * ============================================================================= */

export interface CreateSupplierInputDto {
  tenantId: string;
  /** Sede operativa del supplier. Default 'GLOBAL' si no se especifica. */
  entityId?: string;
  name: string;
  taxId: string;
  contactEmail: string;
  fidelityScore?: number;
  thresholdPolicy?: ThresholdPolicyDto;
  contactInfo?: SupplierContactInfoDto;
  strategicIntelligence?: StrategicIntelligenceDto;
  vendorPerformance?: VendorPerformanceDto;
  smartThresholds?: SmartThresholdsDto;
  complianceAndRisk?: ComplianceAndRiskDto;
}

export interface UpdateSupplierInputDto {
  tenantId: string;
  id: string;
  entityId?: string;
  name?: string;
  taxId?: string;
  contactEmail?: string;
  fidelityScore?: number;
  thresholdPolicy?: ThresholdPolicyDto;
  contactInfo?: SupplierContactInfoDto;
  strategicIntelligence?: StrategicIntelligenceDto;
  vendorPerformance?: VendorPerformanceDto;
  smartThresholds?: SmartThresholdsDto;
  complianceAndRisk?: ComplianceAndRiskDto;
}

export interface DeleteSupplierResultDto {
  tenantId: string;
  id: string;
  deleted: boolean;
}

export interface SupplierDto {
  tenantId: string;
  entityId: string;
  id: string;
  name: string;
  taxId: string;
  contactEmail: string;
  /** 0..100 — score interno legacy de fidelidad/cumplimiento. */
  fidelityScore: number;
  thresholdPolicy: ThresholdPolicyDto;
  createdAt: string;
  updatedAt: string;
  /** Versión OCC del item en DynamoDB. */
  versionId?: number;

  // ─────────── Extensiones del design ProcureTech OS (opcionales) ───────────
  contactInfo?: SupplierContactInfoDto;
  strategicIntelligence?: StrategicIntelligenceDto;
  vendorPerformance?: VendorPerformanceDto;
  smartThresholds?: SmartThresholdsDto;
  complianceAndRisk?: ComplianceAndRiskDto;
}
