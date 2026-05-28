import type { Budget } from '../entities/budget';

export interface IBudgetRepository {
  /** Persiste el agregado (upsert). */
  save(budget: Budget): Promise<void>;

  findById(supplierId: string, budgetId: string): Promise<Budget | null>;

  listBySupplier(supplierId: string, limit?: number): Promise<Budget[]>;
}

export const BUDGET_REPOSITORY = Symbol('IBudgetRepository');
