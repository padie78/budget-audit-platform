import {
  Budget,
  type ExtractedBudget,
  type LegalClauseRisk,
  type PriceDiscrepancy,
  type ThreeWayMatchResult,
  type CashFlowProjection,
} from '@budget-audit/domain';
import {
  type BudgetDto,
  type ExtractedBudgetDto,
  type LegalClauseRiskDto,
  type PriceDiscrepancyDto,
  type ThreeWayMatchResultDto,
  type CashFlowProjectionDto,
} from '@budget-audit/common';

export class BudgetMapper {
  static toDto(budget: Budget): BudgetDto {
    const snap = budget.toSnapshot();
    const currency = snap.extractedBudget?.currency ?? snap.totalDeviation?.currency ?? 'USD';

    return {
      id: snap.id,
      supplierId: snap.supplierId,
      contractId: snap.contractId,
      s3Url: snap.s3Url,
      status: snap.status,
      decision: snap.decision,
      currency,
      extractedBudget: snap.extractedBudget
        ? BudgetMapper.extractedToDto(snap.extractedBudget)
        : null,
      discrepancies: snap.discrepancies.map(BudgetMapper.discrepancyToDto),
      legalRisks: snap.legalRisks.map(BudgetMapper.legalRiskToDto),
      threeWayMatch: snap.threeWayMatch
        ? BudgetMapper.threeWayMatchToDto(snap.threeWayMatch)
        : null,
      cashFlowProjection: snap.cashFlowProjection
        ? BudgetMapper.cashFlowToDto(snap.cashFlowProjection)
        : null,
      totalDeviationAmount: snap.totalDeviation?.amount ?? 0,
      totalDeviationPercent: budget.totalDeviationPercent,
      errorMessage: snap.errorMessage,
      createdAt: snap.createdAt.toISOString(),
      updatedAt: snap.updatedAt.toISOString(),
    };
  }

  private static discrepancyToDto(d: PriceDiscrepancy): PriceDiscrepancyDto {
    return {
      sku: d.sku,
      description: d.description,
      quantity: d.quantity,
      agreedUnitPrice: d.agreedUnitPrice?.amount ?? null,
      quotedUnitPrice: d.quotedUnitPrice.amount,
      deviationPercent: d.deviationPercent,
      deviationPerUnit: d.deviationPerUnit.amount,
      projectedImpact: d.projectedImpact.amount,
      severity: d.severity,
      message: d.message,
    };
  }

  private static legalRiskToDto(r: LegalClauseRisk): LegalClauseRiskDto {
    return {
      clauseId: r.clauseId,
      category: r.category,
      excerpt: r.excerpt,
      rationale: r.rationale,
      modelConfidence: r.modelConfidence,
      riskScore: r.riskScore,
      severity: r.severity,
      suggestion: r.suggestion,
    };
  }

  private static threeWayMatchToDto(t: ThreeWayMatchResult): ThreeWayMatchResultDto {
    return {
      lines: t.lines.map((l) => ({
        sku: l.sku,
        description: l.description,
        contractPrice: l.contractPrice?.amount ?? null,
        poPrice: l.poPrice?.amount ?? null,
        invoicePrice: l.invoicePrice?.amount ?? null,
        poQuantity: l.poQuantity,
        invoiceQuantity: l.invoiceQuantity,
        status: l.status,
        severity: l.severity,
        notes: l.notes,
      })),
      matchedCount: t.matchedCount,
      mismatchedCount: t.mismatchedCount,
      totalAuthorized: t.totalAuthorized.amount,
      totalInvoiced: t.totalInvoiced.amount,
      paymentExposure: t.paymentExposure.amount,
    };
  }

  private static cashFlowToDto(c: CashFlowProjection): CashFlowProjectionDto {
    return {
      monthlyOverrun: c.monthlyOverrun.amount,
      annualizedOverrun: c.annualizedOverrun.amount,
      projectedFinalOverrun: c.projectedFinalOverrun.amount,
      marginErosionPercent: c.marginErosionPercent,
    };
  }

  private static extractedToDto(e: ExtractedBudget): ExtractedBudgetDto {
    return {
      supplierName: e.supplierName,
      quoteNumber: e.quoteNumber,
      currency: e.currency,
      issuedAt: e.issuedAt ? e.issuedAt.toISOString() : null,
      totalAmount: e.totalAmount.amount,
      legalText: e.legalText,
      items: e.items.map((it) => ({
        sku: it.sku,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice.amount,
        lineTotal: it.lineTotal.amount,
      })),
    };
  }
}
