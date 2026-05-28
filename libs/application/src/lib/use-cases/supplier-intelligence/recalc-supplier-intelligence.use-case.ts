/* =============================================================================
 * RecalcSupplierIntelligenceUseCase — orquestador.
 *
 * Corre los recálculos en el ORDEN CORRECTO:
 *   1. vendor_performance  (necesario para risk y trend)
 *   2. esg_score           (necesario para risk.compliance component)
 *   3. risk_profile        (depende de los dos anteriores)
 *   4. payment_strategy    (depende de risk_level)
 *
 * Las categorías de threshold y la extracción de docs son flujos
 * independientes y se exponen como use cases separados.
 *
 * Trigger típico:
 *   • on-event: auditoría completada
 *   • cron diario por tenant para suppliers activos
 * ============================================================================= */

import type { Supplier } from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';

import {
  RecalcVendorPerformanceUseCase,
  type RecalcVendorPerformanceDeps,
} from './recalc-vendor-performance.use-case';
import {
  RecalcEsgScoreUseCase,
  type RecalcEsgScoreDeps,
} from './recalc-esg-score.use-case';
import {
  RecalcRiskProfileUseCase,
  type RecalcRiskProfileDeps,
} from './recalc-risk-profile.use-case';
import {
  RecalcPaymentStrategyUseCase,
  type RecalcPaymentStrategyDeps,
} from './recalc-payment-strategy.use-case';

export interface RecalcSupplierIntelligenceCommand {
  tenantId: string;
  supplierId: string;
  /** Override scores ESG de auditorías recientes si se reciben en el trigger. */
  recentEsgAuditScores?: number[];
  /** Skip steps específicos si el caller ya los corrió. */
  skip?: {
    vendorPerformance?: boolean;
    esgScore?: boolean;
    riskProfile?: boolean;
    paymentStrategy?: boolean;
  };
}

export type RecalcSupplierIntelligenceDeps = RecalcVendorPerformanceDeps &
  RecalcEsgScoreDeps &
  RecalcRiskProfileDeps &
  RecalcPaymentStrategyDeps & {
    logger: ILogger;
  };

export interface RecalcSupplierIntelligenceResult {
  ranSteps: string[];
  skippedSteps: string[];
  finalSnapshot: Supplier;
}

export class RecalcSupplierIntelligenceUseCase {
  private readonly vendorPerformance: RecalcVendorPerformanceUseCase;
  private readonly esgScore: RecalcEsgScoreUseCase;
  private readonly riskProfile: RecalcRiskProfileUseCase;
  private readonly paymentStrategy: RecalcPaymentStrategyUseCase;

  constructor(private readonly deps: RecalcSupplierIntelligenceDeps) {
    this.vendorPerformance = new RecalcVendorPerformanceUseCase(deps);
    this.esgScore = new RecalcEsgScoreUseCase(deps);
    this.riskProfile = new RecalcRiskProfileUseCase(deps);
    this.paymentStrategy = new RecalcPaymentStrategyUseCase(deps);
  }

  async execute(
    cmd: RecalcSupplierIntelligenceCommand,
  ): Promise<RecalcSupplierIntelligenceResult> {
    const ranSteps: string[] = [];
    const skippedSteps: string[] = [];

    if (!cmd.skip?.vendorPerformance) {
      await this.vendorPerformance.execute({
        tenantId: cmd.tenantId,
        supplierId: cmd.supplierId,
      });
      ranSteps.push('vendor_performance');
    } else {
      skippedSteps.push('vendor_performance');
    }

    if (!cmd.skip?.esgScore) {
      try {
        await this.esgScore.execute({
          tenantId: cmd.tenantId,
          supplierId: cmd.supplierId,
          recentEsgAuditScores: cmd.recentEsgAuditScores,
        });
        ranSteps.push('esg_score');
      } catch (err) {
        this.deps.logger.warn(
          'esg_score skipped (probablemente complianceAndRisk no inicializado)',
          { error: (err as Error).message },
        );
        skippedSteps.push('esg_score');
      }
    } else {
      skippedSteps.push('esg_score');
    }

    if (!cmd.skip?.riskProfile) {
      await this.riskProfile.execute({
        tenantId: cmd.tenantId,
        supplierId: cmd.supplierId,
      });
      ranSteps.push('risk_profile');
    } else {
      skippedSteps.push('risk_profile');
    }

    if (!cmd.skip?.paymentStrategy) {
      await this.paymentStrategy.execute({
        tenantId: cmd.tenantId,
        supplierId: cmd.supplierId,
      });
      ranSteps.push('payment_strategy');
    } else {
      skippedSteps.push('payment_strategy');
    }

    const finalSnapshot = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!finalSnapshot) {
      throw new Error(`Supplier ${cmd.supplierId} no encontrado tras recalc.`);
    }

    this.deps.logger.info('supplier intelligence recalculada', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      ranSteps,
      skippedSteps,
    });

    return { ranSteps, skippedSteps, finalSnapshot };
  }
}
