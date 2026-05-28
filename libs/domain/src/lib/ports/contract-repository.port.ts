import type { Contract } from '../entities/contract';

export interface IContractRepository {
  /** Devuelve el contrato vigente para un proveedor en la fecha indicada. */
  findActiveBySupplier(supplierId: string, at?: Date): Promise<Contract | null>;

  findById(supplierId: string, contractId: string): Promise<Contract | null>;
}

export const CONTRACT_REPOSITORY = Symbol('IContractRepository');
