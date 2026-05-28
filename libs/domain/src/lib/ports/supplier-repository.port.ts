import type { Supplier } from '../entities/supplier';

export interface ISupplierRepository {
  findById(supplierId: string): Promise<Supplier | null>;
}

export const SUPPLIER_REPOSITORY = Symbol('ISupplierRepository');
