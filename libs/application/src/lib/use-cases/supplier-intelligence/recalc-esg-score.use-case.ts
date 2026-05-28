/* =============================================================================
 * RecalcEsgScoreUseCase — recalcula `compliance_and_risk.esg_compliance_score`.
 *
 * Trigger: cron trimestral + on-event (cert agregada, auditoría ESG nueva).
 * ============================================================================= */

import {
  ComplianceAndRisk,
  EsgScoreCalculator,
  SupplierNotFoundError,
  type ISupplierRepository,
} from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';
import { applySupplierPatch } from './supplier-patch';

export interface RecalcEsgScoreCommand {
  tenantId: string;
  supplierId: string;
  /** Scores ESG de auditorías recientes (0..100), opcional. */
  recentEsgAuditScores?: number[];
}

export interface RecalcEsgScoreDeps {
  supplierRepository: ISupplierRepository;
  logger: ILogger;
}

export class RecalcEsgScoreUseCase {
  constructor(private readonly deps: RecalcEsgScoreDeps) {}

  async execute(cmd: RecalcEsgScoreCommand): Promise<ComplianceAndRisk> {
    const supplier = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(cmd.supplierId);

    const current = supplier.complianceAndRisk;
    if (!current) {
      throw new Error(
        `Supplier ${cmd.supplierId} no tiene complianceAndRisk inicializado.`,
      );
    }

    const result = EsgScoreCalculator.compute({
      certifications: [...current.certifications],
      primarySectorCode: current.primarySectorCode,
      recentEsgAuditScores: cmd.recentEsgAuditScores,
    });

    const next = ComplianceAndRisk.of({
      status: current.status,
      lastAuditDate: new Date(),
      certifications: [...current.certifications],
      esgComplianceScore: result.esgComplianceScore,
      primarySectorCode: current.primarySectorCode,
    });

    const patched = applySupplierPatch(supplier, { complianceAndRisk: next });
    await this.deps.supplierRepository.save(patched);

    this.deps.logger.info('esg_compliance_score recalculado', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      score: result.esgComplianceScore,
      components: result.components,
    });

    return next;
  }
}
