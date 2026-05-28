import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda';
import {
  DynamoDbBudgetRepository,
  DynamoDbSupplierRepository,
} from '@budget-audit/infrastructure';
import { BudgetMapper } from '@budget-audit/application';
import type { BudgetDto, SupplierDto } from '@budget-audit/common';

type ResolverArgs =
  | { fieldName: 'getBudget'; args: { supplierId: string; budgetId: string } }
  | {
      fieldName: 'listBudgetsBySupplier';
      args: { supplierId: string; limit?: number };
    }
  | { fieldName: 'getSupplier'; args: { supplierId: string } };

let cachedBudgetRepo: DynamoDbBudgetRepository | undefined;
let cachedSupplierRepo: DynamoDbSupplierRepository | undefined;

function budgets(): DynamoDbBudgetRepository {
  if (!cachedBudgetRepo) cachedBudgetRepo = new DynamoDbBudgetRepository();
  return cachedBudgetRepo;
}
function suppliers(): DynamoDbSupplierRepository {
  if (!cachedSupplierRepo) cachedSupplierRepo = new DynamoDbSupplierRepository();
  return cachedSupplierRepo;
}

/**
 * Router para los queries de AppSync (Direct Lambda Resolver agrupado por
 * `info.fieldName`). Centralizar aquí evita desplegar una Lambda por field
 * en etapas tempranas, manteniendo cold starts bajos.
 */
export const handler: AppSyncResolverHandler<
  Record<string, unknown>,
  BudgetDto | BudgetDto[] | SupplierDto | null
> = async (event: AppSyncResolverEvent<Record<string, unknown>>) => {
  const op = {
    fieldName: event.info.fieldName,
    args: event.arguments,
  } as unknown as ResolverArgs;

  switch (op.fieldName) {
    case 'getBudget': {
      const budget = await budgets().findById(op.args.supplierId, op.args.budgetId);
      return budget ? BudgetMapper.toDto(budget) : null;
    }
    case 'listBudgetsBySupplier': {
      const list = await budgets().listBySupplier(
        op.args.supplierId,
        op.args.limit,
      );
      return list.map((b) => BudgetMapper.toDto(b));
    }
    case 'getSupplier': {
      const supplier = await suppliers().findById(op.args.supplierId);
      if (!supplier) return null;
      const snap = supplier.toJSON();
      return {
        id: snap.id,
        name: snap.name,
        taxId: snap.taxId,
        contactEmail: snap.contactEmail,
        createdAt: snap.createdAt.toISOString(),
        updatedAt: snap.updatedAt.toISOString(),
      };
    }
    default:
      throw new Error(`Field no soportado: ${event.info.fieldName}`);
  }
};
