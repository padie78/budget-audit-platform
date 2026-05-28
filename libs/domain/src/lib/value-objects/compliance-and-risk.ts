/* =============================================================================
 * Compliance & Risk — bloque enterprise que captura el estado regulatorio,
 * certificaciones y huella ESG del proveedor.
 *
 * Drives:
 *   - Sourcing decisions (suspendido/bloqueado → no permitir nuevas auditorías).
 *   - Reportes ESG corporativos (esg_compliance_score promedio por sede).
 *   - Filtros de búsqueda en el Portal (por sector / certificación).
 * ============================================================================= */

export type SupplierStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BLOCKED'
  | 'INACTIVE';

export interface ComplianceAndRiskProps {
  /** Estado regulatorio del proveedor en el catálogo del tenant. */
  status: SupplierStatus;
  /** ISO timestamp de la última auditoría compliance/ESG/legal. */
  lastAuditDate: Date;
  /** Lista de certificaciones vigentes (ISO-9001, SOC2, ISO-14001, ...). */
  certifications: string[];
  /** 0..100 — score ESG compuesto (medio ambiente + social + governance). */
  esgComplianceScore: number;
  /** Categoría operacional principal (RAW_MATERIALS, LOGISTICS, IT_SERVICES). */
  primarySectorCode: string;
}

export class ComplianceAndRisk {
  private constructor(private readonly props: ComplianceAndRiskProps) {}

  static of(props: ComplianceAndRiskProps): ComplianceAndRisk {
    if (props.esgComplianceScore < 0 || props.esgComplianceScore > 100) {
      throw new Error(
        `esgComplianceScore fuera de rango 0..100: ${props.esgComplianceScore}`,
      );
    }
    if (!props.primarySectorCode?.trim()) {
      throw new Error('primarySectorCode no puede ser vacío.');
    }
    return new ComplianceAndRisk({
      ...props,
      certifications: [...new Set(props.certifications.map((c) => c.trim()).filter(Boolean))],
    });
  }

  get status(): SupplierStatus { return this.props.status; }
  get lastAuditDate(): Date { return this.props.lastAuditDate; }
  get certifications(): readonly string[] { return this.props.certifications; }
  get esgComplianceScore(): number { return this.props.esgComplianceScore; }
  get primarySectorCode(): string { return this.props.primarySectorCode; }

  isOperational(): boolean {
    return this.props.status === 'ACTIVE';
  }

  hasCertification(name: string): boolean {
    return this.props.certifications.includes(name);
  }
}
