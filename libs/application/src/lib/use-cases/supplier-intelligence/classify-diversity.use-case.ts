/* =============================================================================
 * ClassifyDiversityUseCase — extrae diversity claims de los documentos del
 * proveedor y patchea `strategic_intelligence.diversity_status`.
 *
 * Trigger:
 *   • on-upload: cuando el proveedor sube documentación.
 *   • bajo demanda desde el portal.
 * ============================================================================= */

import {
  DiversityClassifier,
  StrategicIntelligence,
  SupplierNotFoundError,
  type DocumentRef,
  type IAiDocumentExtractor,
  type ISupplierRepository,
} from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';
import { applySupplierPatch } from './supplier-patch';

export interface ClassifyDiversityCommand {
  tenantId: string;
  supplierId: string;
  documents: DocumentRef[];
  minConfidence?: number;
}

export interface ClassifyDiversityResult {
  diversityStatus: string[];
  rejected: { tag: string; reason: string }[];
}

export interface ClassifyDiversityDeps {
  supplierRepository: ISupplierRepository;
  aiExtractor: IAiDocumentExtractor;
  logger: ILogger;
}

export class ClassifyDiversityUseCase {
  constructor(private readonly deps: ClassifyDiversityDeps) {}

  async execute(cmd: ClassifyDiversityCommand): Promise<ClassifyDiversityResult> {
    const supplier = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(cmd.supplierId);

    const findings = await this.deps.aiExtractor.extractDiversityClaims(
      cmd.documents,
    );

    const result = DiversityClassifier.classify({
      findings,
      minConfidence: cmd.minConfidence,
    });

    const currentSi = supplier.strategicIntelligence;
    if (!currentSi) {
      throw new Error(
        `Supplier ${cmd.supplierId} no tiene strategicIntelligence inicializado.`,
      );
    }

    const nextSi = StrategicIntelligence.of({
      riskProfile: currentSi.riskProfile,
      paymentStrategy: currentSi.paymentStrategy,
      diversityStatus: result.diversityStatus,
      criticalityIndex: currentSi.criticalityIndex,
    });

    const patched = applySupplierPatch(supplier, {
      strategicIntelligence: nextSi,
    });
    await this.deps.supplierRepository.save(patched);

    this.deps.logger.info('diversity_status clasificado', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      accepted: result.diversityStatus,
      rejected: result.rejected,
    });

    return {
      diversityStatus: result.diversityStatus,
      rejected: result.rejected,
    };
  }
}
