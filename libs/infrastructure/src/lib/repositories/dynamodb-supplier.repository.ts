import { GetCommand } from '@aws-sdk/lib-dynamodb';
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
  type StrategicIntelligenceDto,
  type SupplierContactInfoDto,
  type SmartThresholdsDto,
  type VendorPerformanceDto,
} from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

/* =============================================================================
 * DynamoDbSupplierRepository — adapter del puerto ISupplierRepository.
 *
 * Hydrata el aggregate root completo incluyendo los bloques enterprise
 * (strategicIntelligence, vendorPerformance, smartThresholds, contactInfo)
 * si están presentes en el item. Los bloques son opcionales: si el item
 * legacy no los tiene, el agregado se construye sin ellos.
 * ============================================================================= */

interface SupplierItem {
  PK: string;
  SK: string;
  entityType: typeof EntityType.Supplier;
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

  // ─────────── Bloques enterprise (opcionales) ───────────
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
    if (!this.tableName) throw new Error('TABLE_NAME env variable es requerida.');
  }

  async findById(supplierId: string): Promise<Supplier | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: DynamoKeys.supplier(supplierId),
      }),
    );
    if (!res.Item) return null;
    return this.toEntity(res.Item as SupplierItem);
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
              lastCheck: new Date(item.strategicIntelligence.riskProfile.lastCheck),
            }),
            paymentStrategy: PaymentStrategy.of({
              earlyPaymentPreferred:
                item.strategicIntelligence.paymentStrategy.earlyPaymentPreferred,
              discountTargetPercentage:
                item.strategicIntelligence.paymentStrategy.discountTargetPercentage,
            }),
            diversityStatus: [...item.strategicIntelligence.diversityStatus],
            criticalityIndex: item.strategicIntelligence.criticalityIndex,
          })
        : undefined;

    const vendorPerformance: VendorPerformance | undefined = item.vendorPerformance
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
