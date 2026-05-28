import {
  AiAnalysis,
  AuditAnalytics,
  Budget,
  DisputeWorkflow,
  PriceDiscrepancySummary,
  type ExtractedBudget,
  type LegalClauseRisk,
  type PriceDiscrepancy,
  type ThreeWayMatchResult,
  type CashFlowProjection,
} from '@budget-audit/domain';
import {
  type AiAnalysisDto,
  type AuditAnalyticsDto,
  type BudgetDto,
  type DisputeWorkflowDto,
  type ExtractedBudgetDto,
  type LegalClauseRiskDto,
  type PriceDiscrepancyDto,
  type PriceDiscrepancySummaryDto,
  type ThreeWayMatchResultDto,
  type CashFlowProjectionDto,
} from '@budget-audit/common';

/* =============================================================================
 * BudgetMapper — Domain → DTO.
 * Serializa todos los bloques del agregado (core + enterprise opcionales).
 * ============================================================================= */
export class BudgetMapper {
  static toDto(budget: Budget): BudgetDto {
    const snap = budget.toSnapshot();
    const currency =
      snap.extractedBudget?.currency ?? snap.totalDeviation?.currency ?? 'USD';

    return {
      tenantId: snap.tenantId,
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

      // ─────────── Extensiones enterprise (opcionales) ───────────
      documentType: snap.documentType,
      purchaseOrderReference: snap.purchaseOrderReference,
      aiAnalysis: snap.aiAnalysis
        ? BudgetMapper.aiAnalysisToDto(snap.aiAnalysis)
        : undefined,
      analytics: snap.analytics
        ? BudgetMapper.analyticsToDto(snap.analytics)
        : undefined,
      metadata: snap.metadata
        ? {
            s3RawPdfPointer: snap.metadata.s3RawPdfPointer,
            processedByLambda: snap.metadata.processedByLambda,
            timestamp: snap.metadata.timestamp?.toISOString(),
            extractionVersion: snap.metadata.extractionVersion,
          }
        : undefined,
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

  private static threeWayMatchToDto(
    t: ThreeWayMatchResult,
  ): ThreeWayMatchResultDto {
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
      invoiceNumber: e.invoiceNumber,
      dueDate: e.dueDate ? e.dueDate.toISOString() : undefined,
      financialsNetAmount: e.financialsNetAmount?.amount,
      financialsTaxAmount: e.financialsTaxAmount?.amount,
      financialsTotalSpend: e.financialsTotalSpend?.amount,
    };
  }

  private static aiAnalysisToDto(a: AiAnalysis): AiAnalysisDto {
    return {
      priceDiscrepancy: a.priceDiscrepancy
        ? BudgetMapper.priceSummaryToDto(a.priceDiscrepancy)
        : undefined,
      legalClauseRisk: a.legalClauseRisks.length
        ? a.legalClauseRisks.map(BudgetMapper.legalRiskToDto)
        : undefined,
      disputeWorkflow: a.disputeWorkflow
        ? BudgetMapper.disputeWorkflowToDto(a.disputeWorkflow)
        : undefined,
    };
  }

  private static priceSummaryToDto(
    s: PriceDiscrepancySummary,
  ): PriceDiscrepancySummaryDto {
    return {
      detectedOvercostUsd: s.detectedOvercost.amount,
      deviationPercentage: s.deviationPercentage,
      severityLevel: s.severityLevel,
      marketBenchmarkPrice: s.marketBenchmarkPrice?.amount ?? null,
    };
  }

  private static disputeWorkflowToDto(w: DisputeWorkflow): DisputeWorkflowDto {
    return {
      status: w.status,
      generatedEmailDraftS3: w.generatedEmailDraftS3,
      history: w.history.map((h) => ({
        timestamp: h.timestamp.toISOString(),
        action: h.action,
        user: h.user,
        note: h.note,
      })),
      assignedTo: w.assignedTo,
    };
  }

  private static analyticsToDto(a: AuditAnalytics): AuditAnalyticsDto {
    return {
      maverickSpendFlag: a.maverickSpendFlag,
      earlyPaymentOpportunity: a.earlyPaymentOpportunity,
      earlyPaymentDiscountDeadline:
        a.earlyPaymentDiscountDeadline?.toISOString() ?? null,
      potentialEarlyPaySavingsUsd: a.potentialEarlyPaySavings.amount,
      dataIntegrityScore: a.dataIntegrityScore,
      llmConfidenceScore: a.llmConfidenceScore,
      totalCo2eImpactKg: a.totalCo2eImpactKg,
    };
  }
}
