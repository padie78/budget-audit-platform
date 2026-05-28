import { Money } from '../value-objects/money';

export interface AgreedItem {
  sku: string;
  description: string;
  unit: string;
  agreedUnitPrice: Money;
  tolerancePercent: number;
}

export interface ContractProps {
  id: string;
  supplierId: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  currency: string;
  agreedItems: Map<string, AgreedItem>;
  createdAt: Date;
  updatedAt: Date;
}

export class Contract {
  private constructor(private props: ContractProps) {}

  static create(props: ContractProps): Contract {
    if (props.agreedItems.size === 0) {
      throw new Error('El contrato debe contener al menos un ítem pactado.');
    }
    return new Contract(props);
  }

  get id(): string {
    return this.props.id;
  }
  get supplierId(): string {
    return this.props.supplierId;
  }
  get currency(): string {
    return this.props.currency;
  }
  get effectiveFrom(): Date {
    return this.props.effectiveFrom;
  }
  get effectiveTo(): Date | null {
    return this.props.effectiveTo;
  }

  isActiveAt(date: Date): boolean {
    if (date < this.props.effectiveFrom) return false;
    if (this.props.effectiveTo && date > this.props.effectiveTo) return false;
    return true;
  }

  findAgreedItem(sku: string): AgreedItem | undefined {
    return this.props.agreedItems.get(sku);
  }

  get agreedItems(): ReadonlyMap<string, AgreedItem> {
    return this.props.agreedItems;
  }
}
