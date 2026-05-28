import {
  Contract,
  type AgreedItem,
  type FinancialLimits,
  type LegalBaseline,
  type PredictiveEngine,
  type SustainabilityEsg,
} from '@budget-audit/domain';
import type {
  AgreedItemDto,
  ContractDto,
  FinancialLimitsDto,
  LegalBaselineDto,
  PredictiveEngineDto,
  SustainabilityEsgDto,
} from '@budget-audit/common';

/* =============================================================================
 * ContractMapper — Domain → DTO.
 * ============================================================================= */
export class ContractMapper {
  static toDto(contract: Contract): ContractDto {
    const snap = contract.toJSON();

    const agreedItems: Record<string, AgreedItemDto> = {};
    for (const [sku, item] of snap.agreedItems.entries()) {
      agreedItems[sku] = ContractMapper.agreedItemToDto(item);
    }

    return {
      id: snap.id,
      supplierId: snap.supplierId,
      effectiveFrom: snap.effectiveFrom.toISOString(),
      effectiveTo: snap.effectiveTo ? snap.effectiveTo.toISOString() : null,
      currency: snap.currency,
      agreedItems,
      createdAt: snap.createdAt.toISOString(),
      updatedAt: snap.updatedAt.toISOString(),

      contractName: snap.contractName,
      status: snap.status,
      financialLimits: snap.financialLimits
        ? ContractMapper.financialLimitsToDto(snap.financialLimits)
        : undefined,
      legalBaseline: snap.legalBaseline
        ? ContractMapper.legalBaselineToDto(snap.legalBaseline)
        : undefined,
      predictiveEngine: snap.predictiveEngine
        ? ContractMapper.predictiveEngineToDto(snap.predictiveEngine)
        : undefined,
      sustainabilityEsg: snap.sustainabilityEsg
        ? ContractMapper.sustainabilityEsgToDto(snap.sustainabilityEsg)
        : undefined,
      metadata: snap.metadata
        ? {
            s3SignedContractPdf: snap.metadata.s3SignedContractPdf,
            uploadedBy: snap.metadata.uploadedBy,
            timestamp: snap.metadata.timestamp?.toISOString(),
            lastAmendmentDate: snap.metadata.lastAmendmentDate?.toISOString(),
            amendmentLog: snap.metadata.amendmentLog,
          }
        : undefined,
    };
  }

  private static agreedItemToDto(item: AgreedItem): AgreedItemDto {
    return {
      sku: item.sku,
      description: item.description,
      unit: item.unit,
      agreedUnitPrice: item.agreedUnitPrice.amount,
      tolerancePercent: item.tolerancePercent,
      category: item.category,
      lastPriceUpdate: item.lastPriceUpdate?.toISOString().slice(0, 10),
    };
  }

  private static financialLimitsToDto(f: FinancialLimits): FinancialLimitsDto {
    return {
      totalBudgetLimit: f.totalBudgetLimit.amount,
      currentBurnRateUsd: f.currentBurnRate.amount,
      allocatedOpexQuota: f.allocatedOpexQuota.amount,
      allocatedCapexQuota: f.allocatedCapexQuota.amount,
      utilizationPercentage: f.utilizationPercentage,
      remainingBudgetUsd: f.remainingBudget.amount,
    };
  }

  private static legalBaselineToDto(l: LegalBaseline): LegalBaselineDto {
    return {
      paymentTermsDays: l.paymentTermsDays,
      earlyPaymentDiscountPercentage: l.earlyPaymentDiscountPercentage,
      earlyPaymentWindowDays: l.earlyPaymentWindowDays,
      jurisdiction: l.jurisdiction,
      penaltyPerDelayDayPercentage: l.penaltyPerDelayDayPercentage,
      governanceComplianceScore: l.governanceComplianceScore,
    };
  }

  private static predictiveEngineToDto(p: PredictiveEngine): PredictiveEngineDto {
    return {
      estimatedDepletionDate: p.estimatedDepletionDate.toISOString(),
      burnRateSeverity: p.burnRateSeverity,
      inflationAdjustmentAlert:
        p.inflationAdjustmentAlert?.toISOString().slice(0, 10) ?? null,
      p90WorstCaseSpendUsd: p.p90WorstCaseSpend.amount,
      contractDriftRisk: p.contractDriftRisk,
    };
  }

  private static sustainabilityEsgToDto(
    s: SustainabilityEsg,
  ): SustainabilityEsgDto {
    return {
      carbonBudgetCo2eKg: s.carbonBudgetCo2eKg,
      currentUsageCo2eKg: s.currentUsageCo2eKg,
      complianceStatus: s.complianceStatus,
    };
  }
}
