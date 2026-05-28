import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Money,
  RiskProfile,
  PaymentStrategy,
  StrategicIntelligence,
  Supplier,
  SmartThresholds,
  ThresholdPolicy,
  VendorPerformance,
  type ISupplierRepository,
  type SupplierContactInfo,
} from '@budget-audit/domain';
import {
  DynamoKeys,
  EntityType,
  KeyPrefix,
  type StrategicIntelligenceDto,
  type SupplierContactInfoDto,
  type SmartThresholdsDto,
  type VendorPerformanceDto,
} from '@budget-audit/common';
import { SupplierMapper } from '@budget-audit/application';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

/* =============================================================================
 * DynamoDbSupplierRepository — adapter del puerto ISupplierRepository.
 *
 * Mapeo (single-table design):
 *   • PK = SUPPLIER#<id>, SK = METADATA
 *   • entityType = SUPPLIER
 *
 * `listAll` usa Scan con filter `SK = METADATA`. Funciona para MVP pero a
 * escala conviene un GSI dedicado (e.g. `GSI1PK=ENTITY#SUPPLIERS`).
 * ============================================================================= */

interface SupplierItem {
  PK: string;
  SK: string;
  entityType: typeof EntityType.Supplier;
  tenantId: string;
  id: string;
  name: string;
  taxId: string;
  contactEmail: string;
  fidelityScore: number;
  thresholdPolicy: {
    percentTolerance: number;
    absoluteTolerance: number | null;
    autoApprovalUpTo: number | null;
    currency: string;
  };
  createdAt: string;
  updatedAt: string;

  // Bloques enterprise opcionales
  contactInfo?: SupplierContactInfoDto;
  strategicIntelligence?: StrategicIntelligenceDto;
  vendorPerformance?: VendorPerformanceDto;
  smartThresholds?: SmartThresholdsDto;
}

export class DynamoDbSupplierRepository implements ISupplierRepository {
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
  ): Promise<Supplier | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: DynamoKeys.supplier(tenantId, supplierId),
      }),
    );
    if (!res.Item) return null;
    return this.toEntity(res.Item as SupplierItem);
  }

  async save(supplier: Supplier): Promise<void> {
    const dto = SupplierMapper.toDto(supplier);
    const keys = DynamoKeys.supplier(supplier.tenantId, supplier.id);

    const item: SupplierItem = {
      PK: keys.PK,
      SK: keys.SK,
      entityType: EntityType.Supplier,
      tenantId: dto.tenantId,
      id: dto.id,
      name: dto.name,
      taxId: dto.taxId,
      contactEmail: dto.contactEmail,
      fidelityScore: dto.fidelityScore,
      thresholdPolicy: dto.thresholdPolicy,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      contactInfo: dto.contactInfo,
      strategicIntelligence: dto.strategicIntelligence,
      vendorPerformance: dto.vendorPerformance,
      smartThresholds: dto.smartThresholds,
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async delete(tenantId: string, supplierId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: DynamoKeys.supplier(tenantId, supplierId),
      }),
    );
  }

  async listAll(tenantId: string, limit?: number): Promise<Supplier[]> {
    const items: SupplierItem[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;
    const pkPrefix = DynamoKeys.tenantSupplierPrefix(tenantId);

    do {
      const res = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression:
            'begins_with(PK, :pkPrefix) AND SK = :sk AND entityType = :type',
          ExpressionAttributeValues: {
            ':pkPrefix': pkPrefix,
            ':sk': KeyPrefix.Metadata,
            ':type': EntityType.Supplier,
          },
          ExclusiveStartKey: lastEvaluatedKey,
          Limit: limit,
        }),
      );

      if (res.Items?.length) items.push(...(res.Items as SupplierItem[]));
      lastEvaluatedKey = res.LastEvaluatedKey;

      if (limit && items.length >= limit) break;
    } while (lastEvaluatedKey);

    const sliced = limit ? items.slice(0, limit) : items;
    return sliced.map((it) => this.toEntity(it));
  }

  private toEntity(item: SupplierItem): Supplier {
    const tp = item.thresholdPolicy;
    const policy = ThresholdPolicy.of({
      percentTolerance: tp.percentTolerance,
      absoluteTolerance:
        tp.absoluteTolerance !== null
          ? Money.from(tp.absoluteTolerance, tp.currency)
          : null,
      autoApprovalUpTo:
        tp.autoApprovalUpTo !== null
          ? Money.from(tp.autoApprovalUpTo, tp.currency)
          : null,
    });

    const contactInfo: SupplierContactInfo | undefined = item.contactInfo
      ? {
          email: item.contactInfo.email,
          phone: item.contactInfo.phone,
          address: item.contactInfo.address,
        }
      : undefined;

    const strategicIntelligence: StrategicIntelligence | undefined =
      item.strategicIntelligence
        ? StrategicIntelligence.of({
            riskProfile: RiskProfile.of({
              score: item.strategicIntelligence.riskProfile.score,
              level: item.strategicIntelligence.riskProfile.level,
              lastCheck: new Date(
                item.strategicIntelligence.riskProfile.lastCheck,
              ),
            }),
            paymentStrategy: PaymentStrategy.of({
              earlyPaymentPreferred:
                item.strategicIntelligence.paymentStrategy.earlyPaymentPreferred,
              discountTargetPercentage:
                item.strategicIntelligence.paymentStrategy
                  .discountTargetPercentage,
            }),
            diversityStatus: [...item.strategicIntelligence.diversityStatus],
            criticalityIndex: item.strategicIntelligence.criticalityIndex,
          })
        : undefined;

    const vendorPerformance: VendorPerformance | undefined =
      item.vendorPerformance
        ? VendorPerformance.of({
            reliabilityScore: item.vendorPerformance.reliabilityScore,
            totalAuditedDocs: item.vendorPerformance.totalAuditedDocs,
            totalDisputesRaised: item.vendorPerformance.totalDisputesRaised,
            averageDisputeResolutionDays:
              item.vendorPerformance.averageDisputeResolutionDays,
            slaDeliveryComplianceRate:
              item.vendorPerformance.slaDeliveryComplianceRate,
            trend: item.vendorPerformance.trend,
          })
        : undefined;

    const smartThresholds: SmartThresholds | undefined = item.smartThresholds
      ? SmartThresholds.fromRecord(
          item.smartThresholds.defaultTolerancePercentage,
          item.smartThresholds.categories,
        )
      : undefined;

    return Supplier.create({
      tenantId: item.tenantId,
      id: item.id,
      name: item.name,
      taxId: item.taxId,
      contactEmail: item.contactEmail,
      fidelityScore: item.fidelityScore ?? 80,
      thresholdPolicy: policy,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      contactInfo,
      strategicIntelligence,
      vendorPerformance,
      smartThresholds,
    });
  }
}
