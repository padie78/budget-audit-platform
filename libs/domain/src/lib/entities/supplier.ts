import { ThresholdPolicy } from '../value-objects/threshold-policy';

export interface SupplierProps {
  id: string;
  name: string;
  taxId: string;
  contactEmail: string;
  /** 0..100 — score interno de fidelidad/cumplimiento del proveedor. */
  fidelityScore: number;
  thresholdPolicy: ThresholdPolicy;
  createdAt: Date;
  updatedAt: Date;
}

export class Supplier {
  private constructor(private props: SupplierProps) {}

  static create(props: SupplierProps): Supplier {
    if (!props.name.trim()) {
      throw new Error('El nombre del proveedor es obligatorio.');
    }
    return new Supplier(props);
  }

  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get taxId(): string { return this.props.taxId; }
  get contactEmail(): string { return this.props.contactEmail; }
  get fidelityScore(): number { return this.props.fidelityScore; }
  get thresholdPolicy(): ThresholdPolicy { return this.props.thresholdPolicy; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  toJSON(): SupplierProps {
    return { ...this.props };
  }
}
