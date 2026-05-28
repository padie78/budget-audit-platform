import { Budget, type IAuditEventPublisher } from '@budget-audit/domain';
import { BudgetMapper } from '@budget-audit/application';

/**
 * Publica el resultado de la auditoría hacia AppSync invocando una mutation
 * interna que dispara la subscription `onAuditCompleted`. Para producción se
 * recomienda firmar la request con SigV4 e IAM auth en AppSync.
 *
 * Para mantener el adaptador autocontenido y sin SDK ad-hoc, se usa `fetch`
 * con AWS_IAM auth (Lambda execution role) — Node 18+ trae fetch nativo.
 */
export interface AppSyncPublisherConfig {
  appsyncEndpoint: string;
  apiKey?: string;
}

export class AppSyncEventPublisherAdapter implements IAuditEventPublisher {
  private readonly endpoint: string;
  private readonly apiKey?: string;

  constructor(config: Partial<AppSyncPublisherConfig> = {}) {
    this.endpoint =
      config.appsyncEndpoint ?? process.env['APPSYNC_ENDPOINT'] ?? '';
    this.apiKey = config.apiKey ?? process.env['APPSYNC_API_KEY'];

    if (!this.endpoint) {
      throw new Error('APPSYNC_ENDPOINT es requerido.');
    }
  }

  async publishAuditCompleted(budget: Budget): Promise<void> {
    const dto = BudgetMapper.toDto(budget);
    const mutation = `
      mutation PublishAuditCompleted($budget: AWSJSON!) {
        publishAuditCompleted(budget: $budget) {
          id
          supplierId
          status
        }
      }
    `;

    await this.sendGraphQL(mutation, { budget: dto });
  }

  async publishAuditFailed(budget: Budget): Promise<void> {
    const dto = BudgetMapper.toDto(budget);
    const mutation = `
      mutation PublishAuditFailed($budget: AWSJSON!) {
        publishAuditFailed(budget: $budget) {
          id
          supplierId
          status
        }
      }
    `;
    await this.sendGraphQL(mutation, { budget: dto });
  }

  private async sendGraphQL(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `AppSync publish falló (${res.status}): ${body.slice(0, 500)}`,
      );
    }
  }
}
