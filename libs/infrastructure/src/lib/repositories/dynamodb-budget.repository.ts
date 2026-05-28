import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AiAnalysis,
  AlertSeverity,
  AuditAnalytics,
  AuditDecision,
  AuditStatus,
  Budget,
  CashFlowProjection,
  DisputeWorkflow,
  LegalClauseRisk,
  Money,
  PriceDiscrepancy,
  PriceDiscrepancySummary,
  ThresholdPolicy,
  type ExtractedBudget,
  type ExtractedBudgetItem,
  type BudgetMetadata,
  type IBudgetRepository,
  type LegalRiskCategory,
  type ThreeWayMatchLine,
  type ThreeWayMatchResult,
} from '@budget-audit/domain';
import { BudgetMapper } from '@budget-audit/application';
import {
  DynamoKeys,
  EntityType,
  KeyPrefix,
  type BudgetDto,
} from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

/* =============================================================================
 * DynamoDbBudgetRepository — persiste el agregado serializado al mismo shape
 * del DTO público. Hydrata reconstruyendo los VOs con sus factory methods.
 *
 * Mantiene back-compat con los items legacy (sin aiAnalysis/analytics/metadata)
 * y soporta los nuevos bloques opcionales.
 * ============================================================================= */

interface BudgetItem extends BudgetDto {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: typeof EntityType.BudgetAudit;
}

export class DynamoDbBudgetRepository implements IBudgetRepository {
  constructor(
    private readonly tableName: string = process.env['TABLE_NAME'] ?? '',
    private readonly client = getDocumentClient(),
  ) {
    if (!this.tableName) throw new Error('TABLE_NAME env variable es requerida.');
  }

  async save(budget: Budget): Promise<void> {
    const snap = budget.toSnapshot();
    const dto = BudgetMapper.toDto(budget);

    const keys = DynamoKeys.audit(
      snap.supplierId,
      snap.id,
      snap.status,
      snap.createdAt.toISOString(),
    );

    const item: BudgetItem = {
      ...keys,
      entityType: EntityType.BudgetAudit,
      ...dto,
    };

    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item }),
    );
  }

  async findById(supplierId: string, budgetId: string): Promise<Budget | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: DynamoKeys.supplier(supplierId).PK,
          SK: `${KeyPrefix.Audit}${budgetId}`,
        },
      }),
    );
    if (!res.Item) return null;
    return this.toEntity(res.Item as BudgetItem);
  }

  async listBySupplier(supplierId: string, limit = 50): Promise<Budget[]> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.supplier(supplierId).PK,
          ':sk': KeyPrefix.Audit,
        },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    return ((res.Items as BudgetItem[] | undefined) ?? []).map((it) =>
      this.toEntity(it),
    );
  }

  private toEntity(item: BudgetItem): Budget {
    const currency = item.currency;
    const policy = ThresholdPolicy.default(currency);

    const extracted: ExtractedBudget | null = item.extractedBudget
      ? {
          supplierName: item.extractedBudget.supplierName,
          quoteNumber: item.extractedBudget.quoteNumber,
          currency: item.extractedBudget.currency,
          issuedAt: item.extractedBudget.issuedAt
            ? new Date(item.extractedBudget.issuedAt)
            : null,
          totalAmount: Money.from(
            item.extractedBudget.totalAmount,
            item.extractedBudget.currency,
          ),
          legalText: item.extractedBudget.legalText,
          items: item.extractedBudget.items.map<ExtractedBudgetItem>((it) => ({
            sku: it.sku,
            description: it.description,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: Money.from(it.unitPrice, item.extractedBudget!.currency),
            lineTotal: Money.from(it.lineTotal, item.extractedBudget!.currency),
          })),
          invoiceNumber: item.extractedBudget.invoiceNumber,
          dueDate: item.extractedBudget.dueDate
            ? new Date(item.extractedBudget.dueDate)
            : undefined,
          financialsNetAmount:
            item.extractedBudget.financialsNetAmount !== undefined
              ? Money.from(
                  item.extractedBudget.financialsNetAmount,
                  item.extractedBudget.currency,
                )
              : undefined,
          financialsTaxAmount:
            item.extractedBudget.financialsTaxAmount !== undefined
              ? Money.from(
                  item.extractedBudget.financialsTaxAmount,
                  item.extractedBudget.currency,
                )
              : undefined,
          financialsTotalSpend:
            item.extractedBudget.financialsTotalSpend !== undefined
              ? Money.from(
                  item.extractedBudget.financialsTotalSpend,
                  item.extractedBudget.currency,
                )
              : undefined,
        }
      : null;

    const discrepancies: PriceDiscrepancy[] = item.discrepancies.map((d) =>
      PriceDiscrepancy.compute({
        sku: d.sku,
        description: d.description,
        quantity: d.quantity,
        quotedUnitPrice: Money.from(d.quotedUnitPrice, currency),
        agreedUnitPrice:
          d.agreedUnitPrice !== null
            ? Money.from(d.agreedUnitPrice, currency)
            : null,
        policy,
      }),
    );

    const legalRisks: LegalClauseRisk[] = item.legalRisks.map((r) =>
      LegalClauseRisk.of({
        clauseId: r.clauseId,
        category: r.category as LegalRiskCategory,
        excerpt: r.excerpt,
        rationale: r.rationale,
        modelConfidence: r.modelConfidence,
        riskScore: r.riskScore,
        suggestion: r.suggestion,
      }),
    );

    const threeWayMatch: ThreeWayMatchResult | null = item.threeWayMatch
      ? {
          lines: item.threeWayMatch.lines.map<ThreeWayMatchLine>((l) => ({
            sku: l.sku,
            description: l.description,
            contractPrice:
              l.contractPrice !== null ? Money.from(l.contractPrice, currency) : null,
            poPrice: l.poPrice !== null ? Money.from(l.poPrice, currency) : null,
            invoicePrice:
              l.invoicePrice !== null ? Money.from(l.invoicePrice, currency) : null,
            poQuantity: l.poQuantity,
            invoiceQuantity: l.invoiceQuantity,
            status: l.status,
            severity: l.severity,
            notes: l.notes,
          })),
          matchedCount: item.threeWayMatch.matchedCount,
          mismatchedCount: item.threeWayMatch.mismatchedCount,
          totalAuthorized: Money.from(item.threeWayMatch.totalAuthorized, currency),
          totalInvoiced: Money.from(item.threeWayMatch.totalInvoiced, currency),
          paymentExposure: Money.from(item.threeWayMatch.paymentExposure, currency),
        }
      : null;

    const cashFlow: CashFlowProjection | null = item.cashFlowProjection
      ? CashFlowProjection.compute({
          totalDeviation: Money.from(item.totalDeviationAmount, currency),
          contractValue: Money.from(item.extractedBudget?.totalAmount ?? 0, currency),
          projectDurationMonths: 0,
          elapsedMonths: 1,
        })
      : null;

    /* ─────────── Bloques enterprise opcionales ─────────── */

    const aiAnalysis: AiAnalysis | undefined = item.aiAnalysis
      ? AiAnalysis.of({
          priceDiscrepancy: item.aiAnalysis.priceDiscrepancy
            ? PriceDiscrepancySummary.of({
                detectedOvercost: Money.from(
                  item.aiAnalysis.priceDiscrepancy.detectedOvercostUsd,
                  currency,
                ),
                deviationPercentage:
                  item.aiAnalysis.priceDiscrepancy.deviationPercentage,
                severityLevel: item.aiAnalysis.priceDiscrepancy
                  .severityLevel as AlertSeverity,
                marketBenchmarkPrice:
                  item.aiAnalysis.priceDiscrepancy.marketBenchmarkPrice !== null
                    ? Money.from(
                        item.aiAnalysis.priceDiscrepancy.marketBenchmarkPrice,
                        currency,
                      )
                    : null,
              })
            : null,
          legalClauseRisks: (item.aiAnalysis.legalClauseRisk ?? []).map((r) =>
            LegalClauseRisk.of({
              clauseId: r.clauseId,
              category: r.category as LegalRiskCategory,
              excerpt: r.excerpt,
              rationale: r.rationale,
              modelConfidence: r.modelConfidence,
              riskScore: r.riskScore,
              suggestion: r.suggestion,
            }),
          ),
          disputeWorkflow: item.aiAnalysis.disputeWorkflow
            ? DisputeWorkflow.of({
                status: item.aiAnalysis.disputeWorkflow.status,
                generatedEmailDraftS3:
                  item.aiAnalysis.disputeWorkflow.generatedEmailDraftS3,
                history: item.aiAnalysis.disputeWorkflow.history.map((h) => ({
                  timestamp: new Date(h.timestamp),
                  action: h.action,
                  user: h.user,
                  note: h.note,
                })),
                assignedTo: item.aiAnalysis.disputeWorkflow.assignedTo,
              })
            : null,
        })
      : undefined;

    const analytics: AuditAnalytics | undefined = item.analytics
      ? AuditAnalytics.of({
          maverickSpendFlag: item.analytics.maverickSpendFlag,
          earlyPaymentOpportunity: item.analytics.earlyPaymentOpportunity,
          earlyPaymentDiscountDeadline:
            item.analytics.earlyPaymentDiscountDeadline !== null
              ? new Date(item.analytics.earlyPaymentDiscountDeadline)
              : null,
          potentialEarlyPaySavings: Money.from(
            item.analytics.potentialEarlyPaySavingsUsd,
            currency,
          ),
          dataIntegrityScore: item.analytics.dataIntegrityScore,
          llmConfidenceScore: item.analytics.llmConfidenceScore,
          totalCo2eImpactKg: item.analytics.totalCo2eImpactKg,
        })
      : undefined;

    const metadata: BudgetMetadata | undefined = item.metadata
      ? {
          s3RawPdfPointer: item.metadata.s3RawPdfPointer,
          processedByLambda: item.metadata.processedByLambda,
          timestamp: item.metadata.timestamp
            ? new Date(item.metadata.timestamp)
            : undefined,
          extractionVersion: item.metadata.extractionVersion,
        }
      : undefined;

    return Budget.rehydrate({
      id: item.id,
      supplierId: item.supplierId,
      contractId: item.contractId,
      s3Url: item.s3Url,
      status: item.status as AuditStatus,
      decision: (item.decision as AuditDecision) ?? AuditDecision.Pending,
      extractedBudget: extracted,
      discrepancies,
      legalRisks,
      threeWayMatch,
      cashFlowProjection: cashFlow,
      totalDeviation: Money.from(item.totalDeviationAmount, currency),
      errorMessage: item.errorMessage,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),

      documentType: item.documentType,
      purchaseOrderReference: item.purchaseOrderReference,
      aiAnalysis,
      analytics,
      metadata,
    });
  }
}
