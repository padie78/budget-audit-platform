/* =============================================================================
 * RecalcPaymentStrategyUseCase — recalcula `strategic_intelligence.payment_strategy`.
 *
 * Trigger:
 *   • cron mensual
 *   • on-event: renegociación de contrato, cambio de risk level
 * ============================================================================= */

import {
  PaymentStrategy,
  PaymentStrategyCalculator,
  StrategicIntelligence,
  SupplierNotFoundError,
  type ICfoContextService,
  type IContractRepository,
  type ISupplierRepository,
  type RiskLevel,
} from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';
import { applySupplierPatch } from './supplier-patch';

export interface RecalcPaymentStrategyCommand {
  tenantId: string;
  supplierId: string;
  /** Override opcional del contrato activo (días neto, días early, descuento promedio). */
  overrides?: {
    netDays?: number;
    earlyDays?: number;
    avgHistoricalDiscountPct?: number;
    strategicSpreadPct?: number;
  };
}

export interface RecalcPaymentStrategyDeps {
  supplierRepository: ISupplierRepository;
  contractRepository: IContractRepository;
  cfoContext: ICfoContextService;
  logger: ILogger;
}

const DEFAULT_NET_DAYS = 60;
const DEFAULT_EARLY_DAYS = 10;
const DEFAULT_HISTORICAL_DISCOUNT_PCT = 0;

export class RecalcPaymentStrategyUseCase {
  constructor(private readonly deps: RecalcPaymentStrategyDeps) {}

  async execute(cmd: RecalcPaymentStrategyCommand): Promise<PaymentStrategy> {
    const supplier = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(cmd.supplierId);

    const [cfo, activeContract] = await Promise.all([
      this.deps.cfoContext.current(cmd.tenantId),
      this.deps.contractRepository.findActiveBySupplier(cmd.tenantId, cmd.supplierId),
    ]);

    const riskLevel: RiskLevel =
      supplier.strategicIntelligence?.riskProfile.level ?? 'MEDIUM';

    const netDays =
      cmd.overrides?.netDays ?? extractNetDays(activeContract) ?? DEFAULT_NET_DAYS;
    const earlyDays = cmd.overrides?.earlyDays ?? DEFAULT_EARLY_DAYS;
    const avgHistoricalDiscountPct =
      cmd.overrides?.avgHistoricalDiscountPct ?? DEFAULT_HISTORICAL_DISCOUNT_PCT;
    const strategicSpreadPct =
      cmd.overrides?.strategicSpreadPct ??
      (supplier.strategicIntelligence?.criticalityIndex === 'STRATEGIC' ? 0.5 : 0);

    const result = PaymentStrategyCalculator.compute({
      riskLevel,
      cfo,
      netDays,
      earlyDays,
      avgHistoricalDiscountPct,
      strategicSpreadPct,
    });

    const currentSi = supplier.strategicIntelligence;
    const nextSi = StrategicIntelligence.of({
      riskProfile: currentSi?.riskProfile ?? supplier.strategicIntelligence!.riskProfile,
      paymentStrategy: result.paymentStrategy,
      diversityStatus: currentSi?.diversityStatus ?? [],
      criticalityIndex: currentSi?.criticalityIndex ?? 'MEDIUM',
    });

    const patched = applySupplierPatch(supplier, {
      strategicIntelligence: nextSi,
    });
    await this.deps.supplierRepository.save(patched);

    this.deps.logger.info('payment_strategy recalculado', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      earlyPaymentPreferred: result.earlyPaymentPreferred,
      discountTargetPercentage: result.discountTargetPercentage,
    });

    return result.paymentStrategy;
  }
}

/**
 * Inferir días netos desde el contrato. Si el contrato no tiene un campo
 * explícito, devuelve null y el use case usa el default.
 */
function extractNetDays(contract: unknown): number | null {
  if (!contract) return null;
  const anyC = contract as { paymentTermsDays?: number };
  return anyC.paymentTermsDays ?? null;
}
