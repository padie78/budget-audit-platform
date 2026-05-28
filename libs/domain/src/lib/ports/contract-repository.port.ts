import type { Contract } from '../entities/contract';

export interface IContractRepository {
  /** Devuelve el contrato vigente para un proveedor del tenant en la fecha. */
  findActiveBySupplier(
    tenantId: string,
    supplierId: string,
    at?: Date,
  ): Promise<Contract | null>;

  findById(
    tenantId: string,
    supplierId: string,
    contractId: string,
  ): Promise<Contract | null>;
}

export const CONTRACT_REPOSITORY = Symbol('IContractRepository');
