import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  Money,
  Supplier,
  ThresholdPolicy,
  type ISupplierRepository,
} from '@budget-audit/domain';
import { DynamoKeys, EntityType } from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

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
    const item = res.Item as SupplierItem;

    const tp = item.thresholdPolicy;
    const policy = ThresholdPolicy.of({
      percentTolerance: tp.percentTolerance,
      absoluteTolerance:
        tp.absoluteTolerance !== null ? Money.from(tp.absoluteTolerance, tp.currency) : null,
      autoApprovalUpTo:
        tp.autoApprovalUpTo !== null ? Money.from(tp.autoApprovalUpTo, tp.currency) : null,
    });

    return Supplier.create({
      id: item.id,
      name: item.name,
      taxId: item.taxId,
      contactEmail: item.contactEmail,
      fidelityScore: item.fidelityScore ?? 80,
      thresholdPolicy: policy,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    });
  }
}
