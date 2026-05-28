/* =============================================================================
 * RecalcVendorPerformanceUseCase — recalcula `vendor_performance` completo
 * (reliability_score, trend, totales, dispute resolution days, sla rate).
 *
 * Trigger:
 *   • on-event al completar una auditoría / cerrar una disputa
 *   • cron diario
 * ============================================================================= */

import {
  ReliabilityCalculator,
  SupplierNotFoundError,
  TrendCalculator,
  VendorPerformance,
  type IAuditHistoryReadModel,
  type IDisputeHistoryReadModel,
  type ISupplierRepository,
} from '@budget-audit/domain';
import type { ILogger } from '../../ports/logger.port';
import { applySupplierPatch } from './supplier-patch';

export interface RecalcVendorPerformanceCommand {
  tenantId: string;
  supplierId: string;
}

export interface RecalcVendorPerformanceDeps {
  supplierRepository: ISupplierRepository;
  auditHistory: IAuditHistoryReadModel;
  disputeHistory: IDisputeHistoryReadModel;
  logger: ILogger;
}

export class RecalcVendorPerformanceUseCase {
  constructor(private readonly deps: RecalcVendorPerformanceDeps) {}

  async execute(cmd: RecalcVendorPerformanceCommand): Promise<VendorPerformance> {
    const supplier = await this.deps.supplierRepository.findById(
      cmd.tenantId,
      cmd.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(cmd.supplierId);

    const [events, windows, avgResolutionDays] = await Promise.all([
      this.deps.auditHistory.listRecent(cmd.tenantId, cmd.supplierId, 500),
      this.deps.auditHistory.listPerformanceWindows(cmd.tenantId, cmd.supplierId),
      this.deps.disputeHistory.averageResolutionDays(cmd.tenantId, cmd.supplierId),
    ]);

    const totalAuditedDocs = events.length;
    const totalDisputesRaised = events.filter((e) => e.hasDispute).length;
    const onTime = events.filter((e) => e.slaDeviationDays <= 0).length;
    const slaDeliveryComplianceRate =
      totalAuditedDocs === 0 ? 1 : onTime / totalAuditedDocs;

    const { reliabilityScore } = ReliabilityCalculator.compute({
      totalAuditedDocs,
      totalDisputesRaised,
      slaDeliveryComplianceRate,
      fidelityScore: supplier.fidelityScore,
    });

    const { trend } = TrendCalculator.compute({ windows });

    const next = VendorPerformance.of({
      reliabilityScore,
      totalAuditedDocs,
      totalDisputesRaised,
      averageDisputeResolutionDays: Math.max(0, avgResolutionDays),
      slaDeliveryComplianceRate,
      trend,
      onboardingStatus:
        supplier.vendorPerformance?.onboardingStatus ??
        (totalAuditedDocs === 0 ? 'PENDING_FIRST_INVOICE' : 'ACTIVE'),
    });

    const patched = applySupplierPatch(supplier, { vendorPerformance: next });
    await this.deps.supplierRepository.save(patched);

    this.deps.logger.info('vendor_performance recalculado', {
      tenantId: cmd.tenantId,
      supplierId: cmd.supplierId,
      reliabilityScore,
      trend,
      totalAuditedDocs,
    });

    return next;
  }
}
