import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  Contract,
  Money,
  type AgreedItem,
  type IContractRepository,
} from '@budget-audit/domain';
import { DynamoKeys, EntityType, KeyPrefix } from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

interface ContractItem {
  PK: string;
  SK: string;
  entityType: typeof EntityType.Contract;
  id: string;
  supplierId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  /** Mapa SKU → AgreedItem serializado. */
  agreedItems: Record<
    string,
    {
      sku: string;
      description: string;
      unit: string;
      agreedUnitPrice: number;
      tolerancePercent?: number;
    }
  >;
  createdAt: string;
  updatedAt: string;
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
    supplierId: string,
    contractId: string,
  ): Promise<Contract | null> {
    const res = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: DynamoKeys.contract(supplierId, contractId),
      }),
    );
    if (!res.Item) return null;
    return this.toEntity(res.Item as ContractItem);
  }

  /**
   * Busca el contrato vigente más reciente para un proveedor. Se hace un
   * Query con begins_with sobre la SK y se filtra en memoria por vigencia.
   */
  async findActiveBySupplier(
    supplierId: string,
    at: Date = new Date(),
  ): Promise<Contract | null> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.supplier(supplierId).PK,
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
      });
    }

    return Contract.create({
      id: item.id,
      supplierId: item.supplierId,
      effectiveFrom: new Date(item.effectiveFrom),
      effectiveTo: item.effectiveTo ? new Date(item.effectiveTo) : null,
      currency: item.currency,
      agreedItems: agreedMap,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
    });
  }
}
