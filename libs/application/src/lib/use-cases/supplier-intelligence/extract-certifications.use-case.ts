/* =============================================================================
 * ExtractCertificationsUseCase — extrae certificaciones de los documentos del
 * proveedor usando el port LLM, valida con `CertificationsValidator` y patchea
 * `compliance_and_risk.certifications`.
 *
 * Trigger:
 *   • on-upload: cuando el proveedor sube un PDF al portal
 *   • cron diario: para detectar certificaciones expiradas
 * ============================================================================= */

import {
  CertificationsValidator,
  ComplianceAndRisk,
  SupplierNotFoundError,
  type IAiDocumentExtractor,
  type ISupplierRepository,
  type DocumentRef,
} from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';
import { applySupplierPatch } from './supplier-patch';

export interface ExtractCertificationsCommand {
  tenantId: string;
  supplierId: string;
  documents: DocumentRef[];
  minConfidence?: number;
}

export interface ExtractCertificationsResult {
  certifications: string[];
  rejected: { name: string; reason: string }[];
}

export interface ExtractCertificationsDeps {
  supplierRepository: ISupplierRepository;
  aiExtractor: IAiDocumentExtractor;
  logger: ILogger;
}

export class ExtractCertificationsUseCase {
  constructor(private readonly deps: ExtractCertificationsDeps) {}

  async execute(
    cmd: ExtractCertificationsCommand,
  ): Promise<ExtractCertificationsResult> {
    const supplier = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(cmd.supplierId);

    const extracted = await this.deps.aiExtractor.extractCertifications(
      cmd.documents,
    );

    const validation = CertificationsValidator.validate({
      extracted,
      minConfidence: cmd.minConfidence,
    });

    const current = supplier.complianceAndRisk;
    const merged = mergeCertifications(
      current?.certifications ? [...current.certifications] : [],
      validation.certifications,
    );

    const next = ComplianceAndRisk.of({
      status: current?.status ?? 'ACTIVE',
      lastAuditDate: new Date(),
      certifications: merged,
      esgComplianceScore: current?.esgComplianceScore ?? 0,
      primarySectorCode: current?.primarySectorCode ?? 'GENERAL',
    });

    const patched = applySupplierPatch(supplier, { complianceAndRisk: next });
    await this.deps.supplierRepository.save(patched);

    this.deps.logger.info('certifications extraídas', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      added: validation.certifications.length,
      rejected: validation.rejected.length,
      total: merged.length,
    });

    return {
      certifications: merged,
      rejected: validation.rejected,
    };
  }
}

/** Une certificaciones nuevas con las existentes sin duplicados. */
function mergeCertifications(existing: string[], incoming: string[]): string[] {
  const set = new Set<string>(existing);
  for (const c of incoming) set.add(c);
  return [...set];
}
