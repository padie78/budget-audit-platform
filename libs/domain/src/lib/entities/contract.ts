import { Money } from '../value-objects/money';
import { FinancialLimits } from '../value-objects/financial-limits';
import { LegalBaseline } from '../value-objects/legal-baseline';
import { PredictiveEngine } from '../value-objects/predictive-engine';
import { SustainabilityEsg } from '../value-objects/sustainability-esg';

/* =============================================================================
 * Contract — aggregate root del contrato marco (price-book + cupos).
 *
 * Mantiene el core (id, supplierId, vigencia, currency, agreedItems) estable
 * para no romper consumidores legacy. Los bloques enterprise del design
 * (financialLimits, legalBaseline, predictiveEngine, sustainabilityEsg) son
 * OPCIONALES.
 * ============================================================================= */

export type ContractStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'PENDING_REVIEW';

export interface AgreedItem {
  sku: string;
  description: string;
  unit: string;
  agreedUnitPrice: Money;
  tolerancePercent: number;

  // ─────────── Extensiones price-book (opcionales) ───────────
  category?: string;
  lastPriceUpdate?: Date;
}

export interface ContractMetadata {
  s3SignedContractPdf?: string;
  uploadedBy?: string;
  timestamp?: Date;
  lastAmendmentDate?: Date;
  amendmentLog?: string;
}

export interface ContractProps {
  tenantId: string;
  id: string;
  supplierId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  currency: string;
  agreedItems: Map<string, AgreedItem>;
  createdAt: Date;
  updatedAt: Date;

  // ─────────── Extensiones enterprise (opcionales) ───────────
  contractName?: string;
  status?: ContractStatus;
  financialLimits?: FinancialLimits;
  legalBaseline?: LegalBaseline;
  predictiveEngine?: PredictiveEngine;
  sustainabilityEsg?: SustainabilityEsg;
  metadata?: ContractMetadata;
}

export class Contract {
  private constructor(private props: ContractProps) {}

  static create(props: ContractProps): Contract {
    if (!props.tenantId?.trim()) {
      throw new Error('tenantId es obligatorio en Contract (multitenant).');
    }
    if (props.agreedItems.size === 0) {
      throw new Error('El contrato debe contener al menos un ítem pactado.');
    }
    return new Contract(props);
  }

  get tenantId(): string { return this.props.tenantId; }
  get id(): string { return this.props.id; }
  get supplierId(): string { return this.props.supplierId; }
  get currency(): string { return this.props.currency; }
  get effectiveFrom(): Date { return this.props.effectiveFrom; }
  get effectiveTo(): Date | null { return this.props.effectiveTo; }
  get agreedItems(): ReadonlyMap<string, AgreedItem> { return this.props.agreedItems; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get contractName(): string | undefined { return this.props.contractName; }
  get status(): ContractStatus | undefined { return this.props.status; }
  get financialLimits(): FinancialLimits | undefined {
    return this.props.financialLimits;
  }
  get legalBaseline(): LegalBaseline | undefined { return this.props.legalBaseline; }
  get predictiveEngine(): PredictiveEngine | undefined {
    return this.props.predictiveEngine;
  }
  get sustainabilityEsg(): SustainabilityEsg | undefined {
    return this.props.sustainabilityEsg;
  }
  get metadata(): ContractMetadata | undefined { return this.props.metadata; }

  isActiveAt(date: Date): boolean {
    if (date < this.props.effectiveFrom) return false;
    if (this.props.effectiveTo && date > this.props.effectiveTo) return false;
    return true;
  }

  findAgreedItem(sku: string): AgreedItem | undefined {
    return this.props.agreedItems.get(sku);
  }

  toJSON(): ContractProps {
    return {
      ...this.props,
      agreedItems: new Map(this.props.agreedItems),
    };
  }
}
