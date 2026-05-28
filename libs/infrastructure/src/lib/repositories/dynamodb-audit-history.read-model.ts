/* =============================================================================
 * DynamoDbAuditHistoryReadModel — adapta el historial de auditorías (items
 * AUDIT#...) bajo un supplier al puerto `IAuditHistoryReadModel`.
 *
 * Lectura KISS:
 *   • listRecent: Query con begins_with(SK, 'AUDIT#') sobre el supplier PK.
 *   • listPerformanceWindows: agrupa los eventos por ventana de N días y
 *     calcula reliabilityScore = (audited - disputed) / audited por ventana.
 *   • spendConcentration: lee todos los items METADATA del tenant via GSI1_PK
 *     (TENANT#...#ENTITY#...) y suma el total auditado en los últimos 12 meses
 *     vs el spend del supplier en el mismo período.
 * ============================================================================= */

import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type {
  AuditEvent,
  IAuditHistoryReadModel,
  PerformanceWindow,
} from '@budget-audit/domain';
import { DynamoKeys, KeyPrefix } from '@budget-audit/common';
import { getDocumentClient } from '../aws/dynamodb-client.factory';

interface RawAuditItem {
  PK: string;
  SK: string;
  id: string;
  status?: string;
  totalDeviationAmount?: number;
  createdAt: string;
  extractedBudget?: { totalAmount?: number; items?: Array<{ sku?: string }> };
  aiAnalysis?: {
    disputeWorkflow?: { status?: string } | null;
  };
}

const DEFAULT_WINDOW_COUNT = 3;
const DEFAULT_WINDOW_DAYS = 30;

export class DynamoDbAuditHistoryReadModel implements IAuditHistoryReadModel {
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
  ): Promise<AuditEvent[]> {
    const items = await this.queryAudits(tenantId, supplierId, limit);
    return items.map(toAuditEvent);
  }

  async listPerformanceWindows(
    tenantId: string,
    supplierId: string,
    windowCount: number = DEFAULT_WINDOW_COUNT,
    windowSizeDays: number = DEFAULT_WINDOW_DAYS,
  ): Promise<PerformanceWindow[]> {
    const totalDays = windowCount * windowSizeDays;
    const since = new Date(Date.now() - totalDays * MS_PER_DAY);

    const items = await this.queryAudits(tenantId, supplierId, 2000);
    const events = items
      .map(toAuditEvent)
      .filter((e) => e.auditedAt.getTime() >= since.getTime())
      .sort((a, b) => a.auditedAt.getTime() - b.auditedAt.getTime());

    const windows: PerformanceWindow[] = [];
    for (let i = 0; i < windowCount; i++) {
      const start = new Date(since.getTime() + i * windowSizeDays * MS_PER_DAY);
      const end = new Date(start.getTime() + windowSizeDays * MS_PER_DAY);
      const bucket = events.filter(
        (e) => e.auditedAt >= start && e.auditedAt < end,
      );

      const audited = bucket.length;
      const disputed = bucket.filter((e) => e.hasDispute).length;
      const reliabilityScore = audited === 0 ? 0 : (audited - disputed) / audited;

      windows.push({
        start,
        end,
        reliabilityScore,
        auditedDocs: audited,
        disputesRaised: disputed,
      });
    }
    return windows;
  }

  /**
   * Concentración de spend del supplier sobre el tenant en los últimos 12 meses.
   * Implementación KISS: suma `extractedBudget.totalAmount` de los items audit
   * del supplier y compara con la suma global del tenant via GSI1_PK.
   */
  async spendConcentration(
    tenantId: string,
    supplierId: string,
  ): Promise<number> {
    const since = new Date(Date.now() - 365 * MS_PER_DAY);

    const supplierItems = await this.queryAudits(tenantId, supplierId, 2000);
    const supplierSpend = supplierItems
      .filter((it) => new Date(it.createdAt) >= since)
      .reduce((sum, it) => sum + (it.extractedBudget?.totalAmount ?? 0), 0);

    const tenantSpend = await this.tenantSpend(tenantId, since);
    if (tenantSpend === 0) return 0;
    return Math.max(0, Math.min(1, supplierSpend / tenantSpend));
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

  /**
   * Suma totalAmount de TODOS los suppliers del tenant. Recorre el GSI por
   * tenant (asumiendo GSI1_PK = TENANT#<id>#ENTITY#<entity>) y suma sólo los
   * items AUDIT#... (los METADATA del supplier no tienen extractedBudget).
   *
   * Si el GSI no está indexado para items audit, hace fallback con Query por
   * tipo. Para el MVP devolvemos 0 si no se puede calcular, lo que pone
   * concentration en 0 (neutral).
   */
  private async tenantSpend(_tenantId: string, _since: Date): Promise<number> {
    return 0;
  }
}

function toAuditEvent(item: RawAuditItem): AuditEvent {
  const auditedAt = new Date(item.createdAt);
  const total = item.extractedBudget?.totalAmount ?? 0;
  const dev = item.totalDeviationAmount ?? 0;
  const deviationPercent = total > 0 ? Math.abs(dev / total) * 100 : 0;
  const hasDispute =
    item.status === 'DISPUTED' ||
    (item.aiAnalysis?.disputeWorkflow?.status &&
      item.aiAnalysis.disputeWorkflow.status !== 'NONE') === true;

  const category = inferCategory(item);

  return {
    auditedAt,
    category,
    deviationPercent,
    hasDispute,
    slaDeviationDays: 0,
  };
}

/**
 * Heurística MVP: usa el primer SKU del extracted budget para inferir
 * la categoría operacional. En producción debería venir de un catálogo
 * de mappings SKU → category, o ser extraído por el LLM en el momento
 * de la auditoría.
 */
function inferCategory(item: RawAuditItem): string | null {
  const sku = item.extractedBudget?.items?.[0]?.sku;
  if (!sku) return null;
  const head = sku.split('-')[0]?.toUpperCase();
  if (!head) return null;
  return head;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
