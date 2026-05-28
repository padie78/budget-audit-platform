/* =============================================================================
 * SuggestCategoryThresholdsUseCase — recalcula `smart_thresholds.categories`
 * basándose en percentiles del historial de auditorías.
 *
 * Trigger: cron mensual.
 *
 * Devuelve siempre el resultado (incluyendo `insufficient`) para que el caller
 * pueda decidir mostrar al usuario qué categorías quedaron en default.
 * Si `applyImmediately` = true, también persiste el supplier patched.
 * ============================================================================= */

import {
  CategoryThresholdsCalculator,
  SmartThresholds,
  SupplierNotFoundError,
  type IAuditHistoryReadModel,
  type ISupplierRepository,
} from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';
import { applySupplierPatch } from './supplier-patch';

export interface SuggestCategoryThresholdsCommand {
  tenantId: string;
  supplierId: string;
  /** Si true, persiste el patch en DynamoDB. Si false, solo sugiere. */
  applyImmediately?: boolean;
  /** Min de muestras por categoría para sugerir. Default 20. */
  minSamples?: number;
}

export interface SuggestCategoryThresholdsResult {
  byCategory: Record<string, number>;
  insufficient: string[];
  smartThresholds: SmartThresholds;
  applied: boolean;
}

export interface SuggestCategoryThresholdsDeps {
  supplierRepository: ISupplierRepository;
  auditHistory: IAuditHistoryReadModel;
  logger: ILogger;
}

export class SuggestCategoryThresholdsUseCase {
  constructor(private readonly deps: SuggestCategoryThresholdsDeps) {}

  async execute(
    cmd: SuggestCategoryThresholdsCommand,
  ): Promise<SuggestCategoryThresholdsResult> {
    const supplier = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(cmd.supplierId);

    const events = await this.deps.auditHistory.listRecent(
      cmd.tenantId,
      cmd.supplierId,
      2000,
    );

    const defaultTolerance =
      supplier.smartThresholds?.defaultTolerancePercentage ??
      supplier.thresholdPolicy.percent;

    const result = CategoryThresholdsCalculator.compute({
      events,
      defaultTolerancePercentage: defaultTolerance,
      minSamples: cmd.minSamples,
    });

    let applied = false;
    if (cmd.applyImmediately) {
      const patched = applySupplierPatch(supplier, {
        smartThresholds: result.smartThresholds,
      });
      await this.deps.supplierRepository.save(patched);
      applied = true;
    }

    this.deps.logger.info('smart_thresholds.categories sugeridas', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      categoriesCount: Object.keys(result.byCategory).length,
      insufficient: result.insufficient,
      applied,
    });

    return {
      byCategory: result.byCategory,
      insufficient: result.insufficient,
      smartThresholds: result.smartThresholds,
      applied,
    };
  }
}
