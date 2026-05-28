/* =============================================================================
 * DynamoDbDisputeHistoryReadModel — extrae disputas desde los items AUDIT#...
 *
 * MVP: las disputas no son items propios todavía; viven dentro de
 * `aiAnalysis.disputeWorkflow.history[]`. Este adapter recorre las auditorías
 * del supplier y reconstruye `DisputeEvent[]`.
 *
 * Cuando se modele Dispute como agregado independiente con sus propios items
 * (`DISPUTE#<id>`), basta cambiar la consulta aquí — el resto del flujo no se
 * entera.
 * ============================================================================= */

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoKeys, KeyPrefix } from '@budget-audit/common';
import type {
  DisputeEvent,
  IDisputeHistoryReadModel,
} from '@budget-audit/domain';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

interface RawAuditItem {
  totalDeviationAmount?: number;
  createdAt: string;
  updatedAt: string;
  status?: string;
  aiAnalysis?: {
    disputeWorkflow?: {
      status?: string;
      history?: Array<{ timestamp: string; action: string }>;
    } | null;
  };
}

export class DynamoDbDisputeHistoryReadModel
  implements IDisputeHistoryReadModel
{
  constructor(
    private readonly tableName: string = process.env['TABLE_NAME'] ?? '',
    private readonly client = getDocumentClient(),
  ) {
    if (!this.tableName) {
      throw new Error('TABLE_NAME env variable es requerida.');
    }
  }

  async listRecent(
    tenantId: string,
    supplierId: string,
    limit = 500,
  ): Promise<DisputeEvent[]> {
    const items = await this.queryAudits(tenantId, supplierId, limit);
    return items.flatMap(toDisputeEvents);
  }

  async averageResolutionDays(
    tenantId: string,
    supplierId: string,
  ): Promise<number> {
    const events = await this.listRecent(tenantId, supplierId, 500);
    const closed = events.filter((e) => e.resolvedAt !== null);
    if (closed.length === 0) return 0;
    const totalDays = closed.reduce((sum, e) => {
      const ms = e.resolvedAt!.getTime() - e.raisedAt.getTime();
      return sum + Math.max(0, ms / MS_PER_DAY);
    }, 0);
    return totalDays / closed.length;
  }

  private async queryAudits(
    tenantId: string,
    supplierId: string,
    limit: number,
  ): Promise<RawAuditItem[]> {
    const res = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': DynamoKeys.supplierPK(tenantId, supplierId),
          ':sk': KeyPrefix.Audit,
        },
        Limit: limit,
        ScanIndexForward: false,
      }),
    );
    return (res.Items as RawAuditItem[] | undefined) ?? [];
  }
}

function toDisputeEvents(item: RawAuditItem): DisputeEvent[] {
  const wf = item.aiAnalysis?.disputeWorkflow;
  if (!wf || wf.status === 'NONE') return [];

  const history = wf.history ?? [];
  const opened = history.find((h) => h.action === 'OPENED');
  const closed = history.find((h) => h.action === 'RESOLVED' || h.action === 'CLOSED');

  const raisedAt = opened ? new Date(opened.timestamp) : new Date(item.createdAt);
  const resolvedAt = closed ? new Date(closed.timestamp) : null;

  return [
    {
      raisedAt,
      resolvedAt,
      amount: item.totalDeviationAmount ?? 0,
    },
  ];
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
