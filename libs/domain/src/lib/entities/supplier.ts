import { ThresholdPolicy } from '../value-objects/threshold-policy';
import { StrategicIntelligence } from '../value-objects/strategic-intelligence';
import { VendorPerformance } from '../value-objects/vendor-performance';
import { SmartThresholds } from '../value-objects/smart-thresholds';
import { ComplianceAndRisk } from '../value-objects/compliance-and-risk';

/* =============================================================================
 * Supplier — aggregate root del proveedor.
 *
 * El shape "core" (id, name, taxId, contactEmail, fidelityScore,
 * thresholdPolicy) se mantiene estable para no romper consumidores legacy.
 *
 * Los bloques enterprise del design (strategicIntelligence, vendorPerformance,
 * smartThresholds, contactInfo) son OPCIONALES: una entidad con solo el core
 * sigue siendo válida — el repo los hidrata si están presentes en DynamoDB.
 * ============================================================================= */

export interface SupplierContactInfo {
  email: string;
  phone?: string;
  address?: string;
}

export interface SupplierProps {
  tenantId: string;
  /**
   * Sede operativa que opera con el proveedor (BEER_SHEVA, BUENOS_AIRES,
   * GLOBAL, ...). Construye el `GSI1_PK = TENANT#<t>#ENTITY#<entityId>` del
   * design canónico, permitiendo filtrar suppliers por sede.
   */
  entityId: string;
  id: string;
  name: string;
  taxId: string;
  contactEmail: string;
  /** 0..100 — score interno legacy de fidelidad/cumplimiento del proveedor. */
  fidelityScore: number;
  thresholdPolicy: ThresholdPolicy;
  createdAt: Date;
  updatedAt: Date;
  /** Control de concurrencia optimista (OCC). Arranca en 1, +1 por save. */
  versionId?: number;

  // ─────────── Extensiones enterprise (opcionales) ───────────
  contactInfo?: SupplierContactInfo;
  strategicIntelligence?: StrategicIntelligence;
  vendorPerformance?: VendorPerformance;
  smartThresholds?: SmartThresholds;
  complianceAndRisk?: ComplianceAndRisk;
}

export const DEFAULT_ENTITY_ID = 'GLOBAL';

export class Supplier {
  private constructor(private props: SupplierProps) {}

  static create(props: SupplierProps): Supplier {
    if (!props.tenantId?.trim()) {
      throw new Error('tenantId es obligatorio en Supplier (multitenant).');
    }
    if (!props.name.trim()) {
      throw new Error('El nombre del proveedor es obligatorio.');
    }
    if (props.fidelityScore < 0 || props.fidelityScore > 100) {
      throw new Error(
        `fidelityScore fuera de rango 0..100: ${props.fidelityScore}`,
      );
    }
    return new Supplier({
      ...props,
      entityId: props.entityId?.trim() || DEFAULT_ENTITY_ID,
      versionId: props.versionId ?? 1,
    });
  }

  get tenantId(): string { return this.props.tenantId; }
  get entityId(): string { return this.props.entityId; }
  get versionId(): number { return this.props.versionId ?? 1; }
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get taxId(): string { return this.props.taxId; }
  get contactEmail(): string { return this.props.contactEmail; }
  get fidelityScore(): number { return this.props.fidelityScore; }
  get thresholdPolicy(): ThresholdPolicy { return this.props.thresholdPolicy; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get contactInfo(): SupplierContactInfo | undefined {
    return this.props.contactInfo;
  }
  get strategicIntelligence(): StrategicIntelligence | undefined {
    return this.props.strategicIntelligence;
  }
  get vendorPerformance(): VendorPerformance | undefined {
    return this.props.vendorPerformance;
  }
  get smartThresholds(): SmartThresholds | undefined {
    return this.props.smartThresholds;
  }
  get complianceAndRisk(): ComplianceAndRisk | undefined {
    return this.props.complianceAndRisk;
  }

  /**
   * Devuelve la tolerancia % para una categoría dada, usando primero
   * `smartThresholds` (si existe) y cayendo a `thresholdPolicy.percent`.
   */
  toleranceForCategory(category: string | null | undefined): number {
    if (this.props.smartThresholds) {
      return this.props.smartThresholds.toleranceFor(category);
    }
    return this.props.thresholdPolicy.percent;
  }

  toJSON(): SupplierProps {
    return { ...this.props };
  }
}
