import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  DEFAULT_ENTITY_ID,
  Money,
  PaymentStrategy,
  RiskProfile,
  SmartThresholds,
  StrategicIntelligence,
  Supplier,
  ThresholdPolicy,
  VendorPerformance,
  type ISupplierRepository,
  type SupplierContactInfo,
} from '@budget-audit/domain';
import { DynamoKeys, EntityType, KeyPrefix } from '@budget-audit/common';
import { SupplierMapper } from '@budget-audit/application';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

/* =============================================================================
 * DynamoDbSupplierRepository — adapter del puerto ISupplierRepository.
 *
 * Persistencia 1:1 con el design canónico (docs/dynamodb_design.md §2.1):
 *   • PK = TENANT#<t>#SUPPLIER#<id>      SK = METADATA
 *   • GSI1_PK = TENANT#<t>#ENTITY#<entityId>
 *   • version_id, s3_large_payload_ref (reservado)
 *   • Todos los atributos en snake_case dentro del item.
 *
 * El dominio sigue trabajando en camelCase; este adapter aísla la conversión.
 * ============================================================================= */

const SCHEMA_VERSION = '1.1.0';

interface SmartThresholdsItem {
  default_tolerance_percentage: number;
  categories: Record<string, number>;
  /** Extensión propietaria: parámetros del workflow de auto-aprobación. */
  auto_approval?: {
    up_to: number | null;
    currency: string;
    absolute_tolerance: number | null;
  };
}

interface SupplierItem {
  PK: string;
  SK: string;
  GSI1_PK: string;
  entityType: typeof EntityType.Supplier;

  version_id: number;
  s3_large_payload_ref: string | null;
  tenant_id: string;
  entity_id: string;
  supplier_id: string;
  supplier_name: string;
  tax_id: string;
  contact_email: string;
  fidelity_score: number;

  contact_info?: {
    email: string;
    phone?: string;
    address?: string;
  };

  strategic_intelligence?: {
    risk_profile: {
      score: number;
      level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      last_check: string;
    };
    payment_strategy: {
      early_payment_preferred: boolean;
      discount_target_percentage: number;
    };
    diversity_status: string[];
    criticality_index: 'LOW' | 'MEDIUM' | 'HIGH' | 'STRATEGIC';
  };

  vendor_performance?: {
    reliability_score: number;
    total_audited_docs: number;
    total_disputes_raised: number;
    average_dispute_resolution_days: number;
    sla_delivery_compliance_rate: number;
    trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  };

  smart_thresholds?: SmartThresholdsItem;

  metadata: {
    created_at: string;
    updated_at: string;
    version: string;
  };
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
    const item = this.toItem(supplier);
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: item }),
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

  /* ─────────────────── Serialización Domain → Item ─────────────────── */

  private toItem(supplier: Supplier): SupplierItem {
    const dto = SupplierMapper.toDto(supplier);
    const keys = DynamoKeys.supplier(supplier.tenantId, supplier.id);
    const entityId = supplier.entityId || DEFAULT_ENTITY_ID;

    const item: SupplierItem = {
      PK: keys.PK,
      SK: keys.SK,
      GSI1_PK: `${KeyPrefix.Tenant}${supplier.tenantId}#ENTITY#${entityId}`,
      entityType: EntityType.Supplier,

      version_id: supplier.versionId ?? 1,
      s3_large_payload_ref: null,
      tenant_id: dto.tenantId,
      entity_id: entityId,
      supplier_id: dto.id,
      supplier_name: dto.name,
      tax_id: dto.taxId,
      contact_email: dto.contactEmail,
      fidelity_score: dto.fidelityScore,

      contact_info: dto.contactInfo
        ? {
            email: dto.contactInfo.email,
            phone: dto.contactInfo.phone,
            address: dto.contactInfo.address,
          }
        : undefined,

      strategic_intelligence: dto.strategicIntelligence
        ? {
            risk_profile: {
              score: dto.strategicIntelligence.riskProfile.score,
              level: dto.strategicIntelligence.riskProfile.level,
              last_check: dto.strategicIntelligence.riskProfile.lastCheck,
            },
            payment_strategy: {
              early_payment_preferred:
                dto.strategicIntelligence.paymentStrategy.earlyPaymentPreferred,
              discount_target_percentage:
                dto.strategicIntelligence.paymentStrategy
                  .discountTargetPercentage,
            },
            diversity_status: [...dto.strategicIntelligence.diversityStatus],
            criticality_index: dto.strategicIntelligence.criticalityIndex,
          }
        : undefined,

      vendor_performance: dto.vendorPerformance
        ? {
            reliability_score: dto.vendorPerformance.reliabilityScore,
            total_audited_docs: dto.vendorPerformance.totalAuditedDocs,
            total_disputes_raised: dto.vendorPerformance.totalDisputesRaised,
            average_dispute_resolution_days:
              dto.vendorPerformance.averageDisputeResolutionDays,
            sla_delivery_compliance_rate:
              dto.vendorPerformance.slaDeliveryComplianceRate,
            trend: dto.vendorPerformance.trend,
          }
        : undefined,

      smart_thresholds: {
        default_tolerance_percentage:
          dto.smartThresholds?.defaultTolerancePercentage ??
          dto.thresholdPolicy.percentTolerance,
        categories: dto.smartThresholds?.categories ?? {},
        auto_approval: {
          up_to: dto.thresholdPolicy.autoApprovalUpTo,
          currency: dto.thresholdPolicy.currency,
          absolute_tolerance: dto.thresholdPolicy.absoluteTolerance,
        },
      },

      metadata: {
        created_at: dto.createdAt,
        updated_at: dto.updatedAt,
        version: SCHEMA_VERSION,
      },
    };
    return item;
  }

  /* ─────────────────── Hidratación Item → Domain ─────────────────── */

  private toEntity(item: SupplierItem): Supplier {
    const policyCurrency = item.smart_thresholds?.auto_approval?.currency ?? 'USD';
    const absTol = item.smart_thresholds?.auto_approval?.absolute_tolerance;
    const autoApp = item.smart_thresholds?.auto_approval?.up_to;
    const policy = ThresholdPolicy.of({
      percentTolerance:
        item.smart_thresholds?.default_tolerance_percentage ?? 0,
      absoluteTolerance:
        absTol !== null && absTol !== undefined
          ? Money.from(absTol, policyCurrency)
          : null,
      autoApprovalUpTo:
        autoApp !== null && autoApp !== undefined
          ? Money.from(autoApp, policyCurrency)
          : null,
    });

    const contactInfo: SupplierContactInfo | undefined = item.contact_info
      ? {
          email: item.contact_info.email,
          phone: item.contact_info.phone,
          address: item.contact_info.address,
        }
      : undefined;

    const strategicIntelligence: StrategicIntelligence | undefined =
      item.strategic_intelligence
        ? StrategicIntelligence.of({
            riskProfile: RiskProfile.of({
              score: item.strategic_intelligence.risk_profile.score,
              level: item.strategic_intelligence.risk_profile.level,
              lastCheck: new Date(
                item.strategic_intelligence.risk_profile.last_check,
              ),
            }),
            paymentStrategy: PaymentStrategy.of({
              earlyPaymentPreferred:
                item.strategic_intelligence.payment_strategy
                  .early_payment_preferred,
              discountTargetPercentage:
                item.strategic_intelligence.payment_strategy
                  .discount_target_percentage,
            }),
            diversityStatus: [...item.strategic_intelligence.diversity_status],
            criticalityIndex: item.strategic_intelligence.criticality_index,
          })
        : undefined;

    const vendorPerformance: VendorPerformance | undefined =
      item.vendor_performance
        ? VendorPerformance.of({
            reliabilityScore: item.vendor_performance.reliability_score,
            totalAuditedDocs: item.vendor_performance.total_audited_docs,
            totalDisputesRaised: item.vendor_performance.total_disputes_raised,
            averageDisputeResolutionDays:
              item.vendor_performance.average_dispute_resolution_days,
            slaDeliveryComplianceRate:
              item.vendor_performance.sla_delivery_compliance_rate,
            trend: item.vendor_performance.trend,
          })
        : undefined;

    const smartThresholds: SmartThresholds | undefined = item.smart_thresholds
      ? SmartThresholds.fromRecord(
          item.smart_thresholds.default_tolerance_percentage,
          item.smart_thresholds.categories,
        )
      : undefined;

    return Supplier.create({
      tenantId: item.tenant_id,
      entityId: item.entity_id ?? DEFAULT_ENTITY_ID,
      id: item.supplier_id,
      name: item.supplier_name,
      taxId: item.tax_id,
      contactEmail: item.contact_email,
      fidelityScore: item.fidelity_score ?? 80,
      thresholdPolicy: policy,
      versionId: item.version_id ?? 1,
      createdAt: new Date(item.metadata.created_at),
      updatedAt: new Date(item.metadata.updated_at),
      contactInfo,
      strategicIntelligence,
      vendorPerformance,
      smartThresholds,
    });
  }
}
