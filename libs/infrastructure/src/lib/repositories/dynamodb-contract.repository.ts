import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  Contract,
  FinancialLimits,
  LegalBaseline,
  Money,
  PredictiveEngine,
  SustainabilityEsg,
  type AgreedItem,
  type ContractMetadata,
  type ContractStatus,
  type IContractRepository,
} from '@budget-audit/domain';
import {
  DynamoKeys,
  EntityType,
  KeyPrefix,
  type AgreedItemDto,
  type ContractDto,
  type FinancialLimitsDto,
  type LegalBaselineDto,
  type PredictiveEngineDto,
  type SustainabilityEsgDto,
} from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

/* =============================================================================
 * DynamoDbContractRepository — adapter del puerto IContractRepository.
 *
 * Hydrata el aggregate root completo (price-book + bloques enterprise).
 * Los bloques nuevos (financialLimits, legalBaseline, predictiveEngine,
 * sustainabilityEsg, metadata) son opcionales.
 * ============================================================================= */

interface ContractItem {
  PK: string;
  SK: string;
  entityType: typeof EntityType.Contract;
  tenantId: string;
  id: string;
  supplierId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  agreedItems: Record<string, AgreedItemDto>;
  createdAt: string;
  updatedAt: string;

  // ─────────── Bloques enterprise (opcionales) ───────────
  contractName?: string;
  status?: ContractDto['status'];
  financialLimits?: FinancialLimitsDto;
  legalBaseline?: LegalBaselineDto;
  predictiveEngine?: PredictiveEngineDto;
  sustainabilityEsg?: SustainabilityEsgDto;
  metadata?: {
    s3SignedContractPdf?: string;
    uploadedBy?: string;
    timestamp?: string;
    lastAmendmentDate?: string;
    amendmentLog?: string;
  };
}

export class DynamoDbContractRepository implements IContractRepository {
  constructor(
    private readonly tableName: string = process.env['TABLE_NAME'] ?? '',
    private readonly client = getDocumentClient(),
  ) {
    if (!this.tableName) {
      throw new Error('TABLE_NAME env variable es requerida.');
    }
  }

  async findById(
    tenantId: string,
    supplierId: string,
    contractId: string,
  ): Promise<Contract | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: DynamoKeys.contract(tenantId, supplierId, contractId),
      }),
    );
    if (!res.Item) return null;
    return this.toEntity(res.Item as ContractItem);
  }

  async findActiveBySupplier(
    tenantId: string,
    supplierId: string,
    at: Date = new Date(),
  ): Promise<Contract | null> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.supplierPK(tenantId, supplierId),
          ':sk': KeyPrefix.Contract,
        },
        ScanIndexForward: false,
      }),
    );

    if (!res.Items || res.Items.length === 0) return null;

    const active = (res.Items as ContractItem[])
      .map((it) => this.toEntity(it))
      .filter((c) => c.isActiveAt(at))
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

    return active[0] ?? null;
  }

  private toEntity(item: ContractItem): Contract {
    const agreedMap = new Map<string, AgreedItem>();
    for (const [sku, raw] of Object.entries(item.agreedItems)) {
      agreedMap.set(sku, {
        sku: raw.sku,
        description: raw.description,
        unit: raw.unit,
        agreedUnitPrice: Money.from(raw.agreedUnitPrice, item.currency),
        tolerancePercent: raw.tolerancePercent ?? 0,
        category: raw.category,
        lastPriceUpdate: raw.lastPriceUpdate
          ? new Date(raw.lastPriceUpdate)
          : undefined,
      });
    }

    const financialLimits: FinancialLimits | undefined = item.financialLimits
      ? FinancialLimits.of({
          totalBudgetLimit: Money.from(
            item.financialLimits.totalBudgetLimit,
            item.currency,
          ),
          currentBurnRate: Money.from(
            item.financialLimits.currentBurnRateUsd,
            item.currency,
          ),
          allocatedOpexQuota: Money.from(
            item.financialLimits.allocatedOpexQuota,
            item.currency,
          ),
          allocatedCapexQuota: Money.from(
            item.financialLimits.allocatedCapexQuota,
            item.currency,
          ),
        })
      : undefined;

    const legalBaseline: LegalBaseline | undefined = item.legalBaseline
      ? LegalBaseline.of({
          paymentTermsDays: item.legalBaseline.paymentTermsDays,
          earlyPaymentDiscountPercentage:
            item.legalBaseline.earlyPaymentDiscountPercentage,
          earlyPaymentWindowDays: item.legalBaseline.earlyPaymentWindowDays,
          jurisdiction: item.legalBaseline.jurisdiction,
          penaltyPerDelayDayPercentage:
            item.legalBaseline.penaltyPerDelayDayPercentage,
          governanceComplianceScore:
            item.legalBaseline.governanceComplianceScore,
        })
      : undefined;

    const predictiveEngine: PredictiveEngine | undefined = item.predictiveEngine
      ? PredictiveEngine.of({
          estimatedDepletionDate: new Date(
            item.predictiveEngine.estimatedDepletionDate,
          ),
          burnRateSeverity: item.predictiveEngine.burnRateSeverity,
          inflationAdjustmentAlert: item.predictiveEngine.inflationAdjustmentAlert
            ? new Date(item.predictiveEngine.inflationAdjustmentAlert)
            : null,
          p90WorstCaseSpend: Money.from(
            item.predictiveEngine.p90WorstCaseSpendUsd,
            item.currency,
          ),
          contractDriftRisk: item.predictiveEngine.contractDriftRisk,
        })
      : undefined;

    const sustainabilityEsg: SustainabilityEsg | undefined = item.sustainabilityEsg
      ? SustainabilityEsg.of({
          carbonBudgetCo2eKg: item.sustainabilityEsg.carbonBudgetCo2eKg,
          currentUsageCo2eKg: item.sustainabilityEsg.currentUsageCo2eKg,
          complianceStatus: item.sustainabilityEsg.complianceStatus,
        })
      : undefined;

    const metadata: ContractMetadata | undefined = item.metadata
      ? {
          s3SignedContractPdf: item.metadata.s3SignedContractPdf,
          uploadedBy: item.metadata.uploadedBy,
          timestamp: item.metadata.timestamp
            ? new Date(item.metadata.timestamp)
            : undefined,
          lastAmendmentDate: item.metadata.lastAmendmentDate
            ? new Date(item.metadata.lastAmendmentDate)
            : undefined,
          amendmentLog: item.metadata.amendmentLog,
        }
      : undefined;

    return Contract.create({
      tenantId: item.tenantId,
      id: item.id,
      supplierId: item.supplierId,
      effectiveFrom: new Date(item.effectiveFrom),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
      currency: item.currency,
      agreedItems: agreedMap,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),

      contractName: item.contractName,
      status: item.status as ContractStatus | undefined,
      financialLimits,
      legalBaseline,
      predictiveEngine,
      sustainabilityEsg,
      metadata,
    });
  }
}
