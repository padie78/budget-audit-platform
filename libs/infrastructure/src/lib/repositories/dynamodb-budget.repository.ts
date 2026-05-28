import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AuditDecision,
  AuditStatus,
  Budget,
  CashFlowProjection,
  LegalClauseRisk,
  Money,
  PriceDiscrepancy,
  ThresholdPolicy,
  type AlertSeverity,
  type ExtractedBudget,
  type ExtractedBudgetItem,
  type IBudgetRepository,
  type LegalRiskCategory,
  type ThreeWayMatchLine,
  type ThreeWayMatchResult,
} from '@budget-audit/domain';
import {
  BudgetMapper,
} from '@budget-audit/application';
import {
  DynamoKeys,
  EntityType,
  KeyPrefix,
  type BudgetDto,
} from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

interface BudgetItem extends BudgetDto {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: typeof EntityType.BudgetAudit;
}

/**
 * Repositorio del agregado Budget. Persiste la entidad serializándola al
 * mismo shape que el DTO público (idempotente y barato de mapear de vuelta).
 */
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

    await this.client.send(new PutCommand({ TableName: this.tableName, Item: item }));
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
    return ((res.Items as BudgetItem[] | undefined) ?? []).map((it) => this.toEntity(it));
  }

  private toEntity(item: BudgetItem): Budget {
    const currency = item.currency;
    const policy = ThresholdPolicy.default(currency);

    const extracted: ExtractedBudget | null = item.extractedBudget
      ? {
          supplierName: item.extractedBudget.supplierName,
          quoteNumber: item.extractedBudget.quoteNumber,
          currency: item.extractedBudget.currency,
          issuedAt: item.extractedBudget.issuedAt ? new Date(item.extractedBudget.issuedAt) : null,
          totalAmount: Money.from(item.extractedBudget.totalAmount, item.extractedBudget.currency),
          legalText: item.extractedBudget.legalText,
          items: item.extractedBudget.items.map<ExtractedBudgetItem>((it) => ({
            sku: it.sku,
            description: it.description,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: Money.from(it.unitPrice, item.extractedBudget!.currency),
            lineTotal: Money.from(it.lineTotal, item.extractedBudget!.currency),
          })),
        }
      : null;

    const discrepancies: PriceDiscrepancy[] = item.discrepancies.map((d) =>
      PriceDiscrepancy.compute({
        sku: d.sku,
        description: d.description,
        quantity: d.quantity,
        quotedUnitPrice: Money.from(d.quotedUnitPrice, currency),
        agreedUnitPrice:
          d.agreedUnitPrice !== null ? Money.from(d.agreedUnitPrice, currency) : null,
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
            contractPrice: l.contractPrice !== null ? Money.from(l.contractPrice, currency) : null,
            poPrice: l.poPrice !== null ? Money.from(l.poPrice, currency) : null,
            invoicePrice: l.invoicePrice !== null ? Money.from(l.invoicePrice, currency) : null,
            poQuantity: l.poQuantity,
            invoiceQuantity: l.invoiceQuantity,
            status: l.status,
            severity: l.severity as AlertSeverity,
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
    });
  }
}
