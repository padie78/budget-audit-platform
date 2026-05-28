import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda';
import {
  DynamoDbBudgetRepository,
  DynamoDbContractRepository,
  DynamoDbSupplierRepository,
} from '@budget-audit/infrastructure';
import {
  BudgetMapper,
  ContractMapper,
  SupplierMapper,
} from '@budget-audit/application';
import type { BudgetDto, ContractDto, SupplierDto } from '@budget-audit/common';

/* =============================================================================
 * AppSync Direct Lambda Resolver — router agrupado por `info.fieldName`.
 *
 * Centralizar evita una Lambda por field en etapas tempranas (cold starts más
 * bajos). Cuando un field tenga lógica significativa, conviene extraerlo a su
 * propio resolver dedicado.
 * ============================================================================= */

type ResolverArgs =
  | { fieldName: 'getBudget'; args: { supplierId: string; budgetId: string } }
  | {
      fieldName: 'listBudgetsBySupplier';
      args: { supplierId: string; limit?: number };
    }
  | { fieldName: 'getSupplier'; args: { supplierId: string } }
  | {
      fieldName: 'getContract';
      args: { supplierId: string; contractId: string };
    }
  | {
      fieldName: 'getActiveContract';
      args: { supplierId: string; at?: string };
    };

type ResolverResult =
  | BudgetDto
  | BudgetDto[]
  | SupplierDto
  | ContractDto
  | null;

let cachedBudgetRepo: DynamoDbBudgetRepository | undefined;
let cachedSupplierRepo: DynamoDbSupplierRepository | undefined;
let cachedContractRepo: DynamoDbContractRepository | undefined;

function budgets(): DynamoDbBudgetRepository {
  if (!cachedBudgetRepo) cachedBudgetRepo = new DynamoDbBudgetRepository();
  return cachedBudgetRepo;
}
function suppliers(): DynamoDbSupplierRepository {
  if (!cachedSupplierRepo) cachedSupplierRepo = new DynamoDbSupplierRepository();
  return cachedSupplierRepo;
}
function contracts(): DynamoDbContractRepository {
  if (!cachedContractRepo) cachedContractRepo = new DynamoDbContractRepository();
  return cachedContractRepo;
}

export const handler: AppSyncResolverHandler<
  Record<string, unknown>,
  ResolverResult
> = async (event: AppSyncResolverEvent<Record<string, unknown>>) => {
  const op = {
    fieldName: event.info.fieldName,
    args: event.arguments,
  } as unknown as ResolverArgs;

  switch (op.fieldName) {
    case 'getBudget': {
      const budget = await budgets().findById(
        op.args.supplierId,
        op.args.budgetId,
      );
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
      return supplier ? SupplierMapper.toDto(supplier) : null;
    }

    case 'getContract': {
      const contract = await contracts().findById(
        op.args.supplierId,
        op.args.contractId,
      );
      return contract ? ContractMapper.toDto(contract) : null;
    }

    case 'getActiveContract': {
      const at = op.args.at ? new Date(op.args.at) : new Date();
      const contract = await contracts().findActiveBySupplier(
        op.args.supplierId,
        at,
      );
      return contract ? ContractMapper.toDto(contract) : null;
    }

    default:
      throw new Error(`Field no soportado: ${event.info.fieldName}`);
  }
};
