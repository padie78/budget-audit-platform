import {
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  AuditStatus,
  Budget,
  Money,
  type BudgetAlert,
  type ExtractedBudget,
  type ExtractedBudgetItem,
  type IBudgetRepository,
} from '@budget-audit/domain';
import {
  DynamoKeys,
  EntityType,
  KeyPrefix,
  type BudgetAlertDto,
  type ExtractedBudgetDto,
} from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

interface BudgetItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  entityType: typeof EntityType.BudgetAudit;
  id: string;
  supplierId: string;
  contractId: string | null;
  s3Url: string;
  status: AuditStatus;
  extractedBudget: ExtractedBudgetDto | null;
  alerts: BudgetAlertDto[];
  totalDeviationAmount: number;
  currency: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export class DynamoDbBudgetRepository implements IBudgetRepository {
  constructor(
    private readonly tableName: string = process.env['TABLE_NAME'] ?? '',
    private readonly client = getDocumentClient(),
  ) {
    if (!this.tableName) {
      throw new Error('TABLE_NAME env variable es requerida.');
    }
  }

  async save(budget: Budget): Promise<void> {
    const snap = budget.toSnapshot();
    const currency =
      snap.extractedBudget?.currency ??
      snap.totalDeviation?.currency ??
      'USD';

    const keys = DynamoKeys.audit(
      snap.supplierId,
      snap.id,
      snap.status,
      snap.createdAt.toISOString(),
    );

    const item: BudgetItem = {
      ...keys,
      entityType: EntityType.BudgetAudit,
      id: snap.id,
      supplierId: snap.supplierId,
      contractId: snap.contractId,
      s3Url: snap.s3Url,
      status: snap.status,
      extractedBudget: snap.extractedBudget
        ? this.serializeExtracted(snap.extractedBudget)
        : null,
      alerts: snap.alerts.map((a) => this.serializeAlert(a)),
      totalDeviationAmount: snap.totalDeviation?.amount ?? 0,
      currency,
      errorMessage: snap.errorMessage,
      createdAt: snap.createdAt.toISOString(),
      updatedAt: snap.updatedAt.toISOString(),
    };

    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item }),
    );
  }

  async findById(
    supplierId: string,
    budgetId: string,
  ): Promise<Budget | null> {
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
    return (res.Items as BudgetItem[] | undefined)?.map((it) =>
      this.toEntity(it),
    ) ?? [];
  }

  private serializeExtracted(extracted: ExtractedBudget): ExtractedBudgetDto {
    return {
      supplierName: extracted.supplierName,
      quoteNumber: extracted.quoteNumber,
      currency: extracted.currency,
      issuedAt: extracted.issuedAt ? extracted.issuedAt.toISOString() : null,
      totalAmount: extracted.totalAmount.amount,
      items: extracted.items.map((it) => ({
        sku: it.sku,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unitPrice: it.unitPrice.amount,
        lineTotal: it.lineTotal.amount,
      })),
    };
  }

  private serializeAlert(alert: BudgetAlert): BudgetAlertDto {
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

  private toEntity(item: BudgetItem): Budget {
    const currency = item.currency;
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

    const alerts: BudgetAlert[] = item.alerts.map((a) => ({
      sku: a.sku,
      description: a.description,
      agreedUnitPrice:
        a.agreedUnitPrice !== null ? Money.from(a.agreedUnitPrice, currency) : null,
      quotedUnitPrice: Money.from(a.quotedUnitPrice, currency),
      deviationPercent: a.deviationPercent,
      severity: a.severity,
      message: a.message,
    }));

    return Budget.rehydrate({
      id: item.id,
      supplierId: item.supplierId,
      contractId: item.contractId,
      s3Url: item.s3Url,
      status: item.status,
      extractedBudget: extracted,
      alerts,
      totalDeviation: Money.from(item.totalDeviationAmount, currency),
      errorMessage: item.errorMessage,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    });
  }
}
