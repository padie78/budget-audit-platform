/* =============================================================================
 * ContractDto — Contrato marco con tarifario, límites financieros y motor
 * predictivo. Mapea con `SK: CONTRACT#<contractId>` (ver dynamodb_design §2.2).
 *
 * Los bloques extendidos del design (`financialLimits`, `legalBaseline`,
 * `predictiveEngine`, `sustainabilityEsg`) son OPCIONALES — un contrato legacy
 * con solo `agreedItems` sigue siendo válido.
 * ============================================================================= */

export interface AgreedItemDto {
  /** SKU o código del ítem según el catálogo del proveedor. */
  sku: string;
  description: string;
  unit: string;
  /** Precio unitario pactado en moneda base (ej. USD). */
  agreedUnitPrice: number;
  /** Tolerancia (%) aceptada antes de generar alerta. Default 0. */
  tolerancePercent?: number;

  // ─────────── Extensiones del price-book enterprise ───────────
  /** Familia operacional (RAW_MATERIALS, LOGISTICS, MAINTENANCE, ...). */
  category?: string;
  /** ISO date del último ajuste de precio. */
  lastPriceUpdate?: string;
}

/** Cupos presupuestarios consumidos y disponibles del contrato. */
export interface FinancialLimitsDto {
  totalBudgetLimit: number;
  currentBurnRateUsd: number;
  allocatedOpexQuota: number;
  allocatedCapexQuota: number;
  /** 0..100, % consumido del total. */
  utilizationPercentage: number;
  remainingBudgetUsd: number;
}

/** Términos legales base que arman el contrato vs factura. */
export interface LegalBaselineDto {
  paymentTermsDays: number;
  earlyPaymentDiscountPercentage: number;
  earlyPaymentWindowDays: number;
  jurisdiction: string;
  penaltyPerDelayDayPercentage: number;
  /** 0..1 — score normalizado de cumplimiento normativo. */
  governanceComplianceScore: number;
}

/** Motor predictivo: estimaciones de agotamiento y drift. */
export interface PredictiveEngineDto {
  /** ISO timestamp estimado de agotamiento del cupo total. */
  estimatedDepletionDate: string;
  burnRateSeverity: 'GREEN' | 'YELLOW' | 'RED';
  /** ISO date de alerta de ajuste inflacionario. */
  inflationAdjustmentAlert: string | null;
  /** Proyección P90 del gasto en escenario adverso. */
  p90WorstCaseSpendUsd: number;
  contractDriftRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** Métricas ESG/Scope-3 asociadas al contrato. */
export interface SustainabilityEsgDto {
  carbonBudgetCo2eKg: number;
  currentUsageCo2eKg: number;
  complianceStatus: 'ON_TRACK' | 'AT_RISK' | 'BREACH';
}

export interface ContractMetadataDto {
  s3SignedContractPdf?: string;
  uploadedBy?: string;
  /** ISO timestamp de subida del contrato firmado. */
  timestamp?: string;
  lastAmendmentDate?: string;
  amendmentLog?: string;
}

export interface ContractDto {
  id: string;
  supplierId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  /** Mapa SKU → ítem pactado para lookup O(1) durante la auditoría. */
  agreedItems: Record<string, AgreedItemDto>;
  createdAt: string;
  updatedAt: string;

  // ─────────── Extensiones del design ProcureTech OS (opcionales) ───────────
  contractName?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'PENDING_REVIEW';
  financialLimits?: FinancialLimitsDto;
  legalBaseline?: LegalBaselineDto;
  predictiveEngine?: PredictiveEngineDto;
  sustainabilityEsg?: SustainabilityEsgDto;
  metadata?: ContractMetadataDto;
}
