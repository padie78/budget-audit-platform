import { Money } from '../value-objects/money';
import { AlertSeverity, SeverityPolicy } from '../value-objects/alert-severity';
import { Contract } from './contract';

export const AuditStatus = {
  Pending: 'PENDING',
  Processing: 'PROCESSING',
  Completed: 'COMPLETED',
  Failed: 'FAILED',
} as const;
export type AuditStatus = (typeof AuditStatus)[keyof typeof AuditStatus];

export interface ExtractedBudgetItem {
  sku: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface ExtractedBudget {
  supplierName: string;
  quoteNumber: string | null;
  currency: string;
  issuedAt: Date | null;
  items: ExtractedBudgetItem[];
  totalAmount: Money;
}

export interface BudgetAlert {
  sku: string;
  description: string;
  agreedUnitPrice: Money | null;
  quotedUnitPrice: Money;
  deviationPercent: number;
  severity: AlertSeverity;
  message: string;
}

export interface BudgetProps {
  id: string;
  supplierId: string;
  contractId: string | null;
  s3Url: string;
  status: AuditStatus;
  extractedBudget: ExtractedBudget | null;
  alerts: BudgetAlert[];
  totalDeviation: Money | null;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregate root del bounded-context de auditoría. Encapsula tanto el estado
 * de procesamiento como las invariantes del algoritmo de comparación contra
 * el contrato línea base.
 */
export class Budget {
  private constructor(private props: BudgetProps) {}

  static initialize(params: {
    id: string;
    supplierId: string;
    s3Url: string;
    contractId?: string | null;
    createdAt?: Date;
  }): Budget {
    const now = params.createdAt ?? new Date();
    return new Budget({
      id: params.id,
      supplierId: params.supplierId,
      contractId: params.contractId ?? null,
      s3Url: params.s3Url,
      status: AuditStatus.Pending,
      extractedBudget: null,
      alerts: [],
      totalDeviation: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static rehydrate(props: BudgetProps): Budget {
    return new Budget(props);
  }

  markAsProcessing(): void {
    this.props.status = AuditStatus.Processing;
    this.props.updatedAt = new Date();
  }

  markAsFailed(reason: string): void {
    this.props.status = AuditStatus.Failed;
    this.props.errorMessage = reason;
    this.props.updatedAt = new Date();
  }

  /**
   * Núcleo de la lógica de negocio: compara el presupuesto extraído contra
   * el contrato línea base. Genera alertas por ítem y deja el agregado
   * en estado COMPLETED.
   */
  auditAgainst(extracted: ExtractedBudget, contract: Contract | null): void {
    this.props.extractedBudget = extracted;
    this.props.contractId = contract?.id ?? null;

    const alerts: BudgetAlert[] = [];
    let totalDeviation = Money.zero(extracted.currency);

    for (const item of extracted.items) {
      const agreed = contract?.findAgreedItem(item.sku);
      const tolerancePercent = agreed?.tolerancePercent ?? 0;
      const agreedPrice = agreed?.agreedUnitPrice ?? null;

      const deviationPercent = agreedPrice
        ? item.unitPrice.deviationPercentAgainst(agreedPrice)
        : 0;

      const severity = SeverityPolicy.fromDeviation({
        deviationPercent,
        tolerancePercent,
        hasAgreedPrice: !!agreedPrice,
      });

      if (agreedPrice && item.unitPrice.greaterThan(agreedPrice)) {
        const diff = item.unitPrice
          .subtract(agreedPrice)
          .multiply(item.quantity);
        totalDeviation = totalDeviation.add(diff);
      }

      alerts.push({
        sku: item.sku,
        description: item.description,
        agreedUnitPrice: agreedPrice,
        quotedUnitPrice: item.unitPrice,
        deviationPercent,
        severity,
        message: Budget.buildAlertMessage(severity, deviationPercent, !!agreed),
      });
    }

    this.props.alerts = alerts;
    this.props.totalDeviation = totalDeviation;
    this.props.status = AuditStatus.Completed;
    this.props.updatedAt = new Date();
  }

  private static buildAlertMessage(
    severity: AlertSeverity,
    deviationPercent: number,
    hasAgreedPrice: boolean,
  ): string {
    if (!hasAgreedPrice) {
      return 'Ítem fuera del contrato línea base; requiere revisión manual.';
    }
    switch (severity) {
      case AlertSeverity.Green:
        return 'Precio cotizado dentro o por debajo del valor pactado.';
      case AlertSeverity.Yellow:
        return `Desvío del ${deviationPercent.toFixed(2)}% dentro de la tolerancia.`;
      case AlertSeverity.Red:
        return `Sobreprecio del ${deviationPercent.toFixed(2)}% respecto al contrato.`;
    }
  }

  get id(): string {
    return this.props.id;
  }
  get supplierId(): string {
    return this.props.supplierId;
  }
  get contractId(): string | null {
    return this.props.contractId;
  }
  get s3Url(): string {
    return this.props.s3Url;
  }
  get status(): AuditStatus {
    return this.props.status;
  }
  get extractedBudget(): ExtractedBudget | null {
    return this.props.extractedBudget;
  }
  get alerts(): readonly BudgetAlert[] {
    return this.props.alerts;
  }
  get totalDeviation(): Money | null {
    return this.props.totalDeviation;
  }
  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get totalDeviationPercent(): number {
    if (!this.props.extractedBudget || !this.props.totalDeviation) return 0;
    const total = this.props.extractedBudget.totalAmount.amount;
    if (total === 0) return 0;
    return (this.props.totalDeviation.amount / total) * 100;
  }

  toSnapshot(): BudgetProps {
    return {
      ...this.props,
      alerts: [...this.props.alerts],
    };
  }
}
