import type { Budget } from '../entities/budget';

export interface IBudgetRepository {
  /** Persiste el agregado (upsert). El tenantId está en la entity. */
  save(budget: Budget): Promise<void>;

  findById(
    tenantId: string,
    supplierId: string,
    budgetId: string,
  ): Promise<Budget | null>;

  listBySupplier(
    tenantId: string,
    supplierId: string,
    limit?: number,
  ): Promise<Budget[]>;
}

export const BUDGET_REPOSITORY = Symbol('IBudgetRepository');
