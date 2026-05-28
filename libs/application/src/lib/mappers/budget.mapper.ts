import {
  Budget,
  type BudgetAlert,
  type ExtractedBudget,
} from '@budget-audit/domain';
import {
  type BudgetAlertDto,
  type BudgetDto,
  type ExtractedBudgetDto,
} from '@budget-audit/common';

export class BudgetMapper {
  static toDto(budget: Budget): BudgetDto {
    const snapshot = budget.toSnapshot();
    return {
      id: snapshot.id,
      supplierId: snapshot.supplierId,
      contractId: snapshot.contractId,
      s3Url: snapshot.s3Url,
      status: snapshot.status,
      extractedBudget: snapshot.extractedBudget
        ? BudgetMapper.extractedToDto(snapshot.extractedBudget)
        : null,
      alerts: snapshot.alerts.map(BudgetMapper.alertToDto),
      totalDeviationAmount: snapshot.totalDeviation?.amount ?? 0,
      totalDeviationPercent: budget.totalDeviationPercent,
      errorMessage: snapshot.errorMessage,
      createdAt: snapshot.createdAt.toISOString(),
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }

  private static alertToDto(alert: BudgetAlert): BudgetAlertDto {
    return {
      sku: alert.sku,
      description: alert.description,
      agreedUnitPrice: alert.agreedUnitPrice?.amount ?? null,
      quotedUnitPrice: alert.quotedUnitPrice.amount,
      deviationPercent: alert.deviationPercent,
      severity: alert.severity,
      message: alert.message,
    };
  }

  private static extractedToDto(extracted: ExtractedBudget): ExtractedBudgetDto {
    return {
      supplierName: extracted.supplierName,
      quoteNumber: extracted.quoteNumber,
      currency: extracted.currency,
      issuedAt: extracted.issuedAt ? extracted.issuedAt.toISOString() : null,
      totalAmount: extracted.totalAmount.amount,
      items: extracted.items.map((item) => ({
        sku: item.sku,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice.amount,
        lineTotal: item.lineTotal.amount,
      })),
    };
  }
}
