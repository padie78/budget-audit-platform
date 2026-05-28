import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { Supplier, type ISupplierRepository } from '@budget-audit/domain';
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
  createdAt: string;
  updatedAt: string;
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

  async findById(supplierId: string): Promise<Supplier | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: DynamoKeys.supplier(supplierId),
      }),
    );
    if (!res.Item) return null;
    const item = res.Item as SupplierItem;
    return Supplier.create({
      id: item.id,
      name: item.name,
      taxId: item.taxId,
      contactEmail: item.contactEmail,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    });
  }
}
