/* =============================================================================
 * RecalcRiskProfileUseCase — recalcula `strategic_intelligence.risk_profile`.
 *
 * Trigger:
 *   • cron semanal
 *   • on-event: disputa abierta, cambio de status, nuevo signal externo
 * ============================================================================= */

import {
  RiskCalculator,
  StrategicIntelligence,
  SupplierNotFoundError,
  type IAuditHistoryReadModel,
  type IExternalRiskSignalsService,
  type ISupplierRepository,
  type RiskProfile,
} from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';
import { applySupplierPatch } from './supplier-patch';

export interface RecalcRiskProfileCommand {
  tenantId: string;
  supplierId: string;
}

export interface RecalcRiskProfileDeps {
  supplierRepository: ISupplierRepository;
  auditHistory: IAuditHistoryReadModel;
  externalRiskSignals: IExternalRiskSignalsService;
  logger: ILogger;
}

export class RecalcRiskProfileUseCase {
  constructor(private readonly deps: RecalcRiskProfileDeps) {}

  async execute(cmd: RecalcRiskProfileCommand): Promise<RiskProfile> {
    const supplier = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(cmd.supplierId);

    const [concentration, externalSignals] = await Promise.all([
      this.deps.auditHistory.spendConcentration(cmd.tenantId, cmd.supplierId),
      this.deps.externalRiskSignals.fetch(cmd.tenantId, cmd.supplierId),
    ]);

    const perf = supplier.vendorPerformance;
    const result = RiskCalculator.compute({
      totalAuditedDocs: perf?.totalAuditedDocs ?? 0,
      totalDisputesRaised: perf?.totalDisputesRaised ?? 0,
      reliabilityScore: perf?.reliabilityScore ?? supplier.fidelityScore / 100,
      esgComplianceScore: supplier.complianceAndRisk?.esgComplianceScore ?? 0,
      supplierStatus: supplier.complianceAndRisk?.status ?? 'ACTIVE',
      spendConcentration: concentration,
      externalSignals,
    });

    const currentSi = supplier.strategicIntelligence;
    const nextSi = StrategicIntelligence.of({
      riskProfile: result.riskProfile,
      paymentStrategy:
        currentSi?.paymentStrategy ??
        (await placeholderPaymentStrategy()),
      diversityStatus: currentSi?.diversityStatus ?? [],
      criticalityIndex: currentSi?.criticalityIndex ?? 'MEDIUM',
    });

    const patched = applySupplierPatch(supplier, {
      strategicIntelligence: nextSi,
    });
    await this.deps.supplierRepository.save(patched);

    this.deps.logger.info('risk_profile recalculado', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      score: result.score,
      level: result.level,
      components: result.components,
    });

    return result.riskProfile;
  }
}

/**
 * Fallback de PaymentStrategy cuando el supplier nunca tuvo strategicIntelligence.
 * No invoca el use case real para no acoplar aquí — se setean defaults neutros
 * (el cron de payment-strategy los recalcula más adelante).
 */
async function placeholderPaymentStrategy() {
  const { PaymentStrategy } = await import('@budget-audit/domain');
  return PaymentStrategy.of({
    earlyPaymentPreferred: false,
    discountTargetPercentage: 0,
  });
}
