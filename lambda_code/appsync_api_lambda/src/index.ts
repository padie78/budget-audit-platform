import type { AppSyncResolverEvent, AppSyncResolverHandler } from 'aws-lambda';
import {
  ConsoleLogger,
  DynamoDbBudgetRepository,
  DynamoDbContractRepository,
  DynamoDbSupplierRepository,
  UuidIdGenerator,
} from '@budget-audit/infrastructure';
import {
  BudgetMapper,
  ContractMapper,
  CreateSupplierUseCase,
  DeleteSupplierUseCase,
  ListSuppliersUseCase,
  SupplierMapper,
  UpdateSupplierUseCase,
} from '@budget-audit/application';
import type {
  BudgetDto,
  ContractDto,
  CreateSupplierInputDto,
  DeleteSupplierResultDto,
  SupplierDto,
  UpdateSupplierInputDto,
} from '@budget-audit/common';

/* =============================================================================
 * AppSync Direct Lambda Resolver — router agrupado por `info.fieldName`.
 *
 * Centralizar evita una Lambda por field en etapas tempranas (cold starts más
 * bajos). Cuando un field tenga lógica significativa, conviene extraerlo a su
 * propio resolver dedicado.
 * ============================================================================= */

/**
 * Shape de SmartThresholds tal como lo envía AppSync: como lista de entries
 * (clean GraphQL) en lugar del Record<string, number> que usa el dominio.
 */
interface SmartThresholdsGraphQLInput {
  defaultTolerancePercentage: number;
  categories?: Array<{ category: string; tolerancePercentage: number }>;
}

interface CreateSupplierGraphQLInput
  extends Omit<CreateSupplierInputDto, 'smartThresholds'> {
  smartThresholds?: SmartThresholdsGraphQLInput;
}

interface UpdateSupplierGraphQLInput
  extends Omit<UpdateSupplierInputDto, 'smartThresholds'> {
  smartThresholds?: SmartThresholdsGraphQLInput;
}

type ResolverArgs =
  | {
      fieldName: 'getBudget';
      args: { tenantId: string; supplierId: string; budgetId: string };
    }
  | {
      fieldName: 'listBudgetsBySupplier';
      args: { tenantId: string; supplierId: string; limit?: number };
    }
  | { fieldName: 'getSupplier'; args: { tenantId: string; supplierId: string } }
  | { fieldName: 'listSuppliers'; args: { tenantId: string; limit?: number } }
  | { fieldName: 'createSupplier'; args: { input: CreateSupplierGraphQLInput } }
  | { fieldName: 'updateSupplier'; args: { input: UpdateSupplierGraphQLInput } }
  | { fieldName: 'deleteSupplier'; args: { tenantId: string; id: string } }
  | {
      fieldName: 'getContract';
      args: { tenantId: string; supplierId: string; contractId: string };
    }
  | {
      fieldName: 'getActiveContract';
      args: { tenantId: string; supplierId: string; at?: string };
    };

/* ─────────── Helpers de mapeo AppSync ↔ Dominio ─────────── */

function smartThresholdsInputToDto(
  input?: SmartThresholdsGraphQLInput,
): { defaultTolerancePercentage: number; categories: Record<string, number> }
  | undefined {
  if (!input) return undefined;
  const categories: Record<string, number> = {};
  for (const e of input.categories ?? []) {
    categories[e.category] = e.tolerancePercentage;
  }
  return {
    defaultTolerancePercentage: input.defaultTolerancePercentage,
    categories,
  };
}

function supplierDtoToGraphQL(dto: SupplierDto): Record<string, unknown> {
  if (!dto.smartThresholds) return { ...dto };
  const categories = Object.entries(dto.smartThresholds.categories).map(
    ([category, tolerancePercentage]) => ({ category, tolerancePercentage }),
  );
  return {
    ...dto,
    smartThresholds: {
      defaultTolerancePercentage:
        dto.smartThresholds.defaultTolerancePercentage,
      categories,
    },
  };
}

function adaptCreateInput(
  input: CreateSupplierGraphQLInput,
): CreateSupplierInputDto {
  return { ...input, smartThresholds: smartThresholdsInputToDto(input.smartThresholds) };
}

function adaptUpdateInput(
  input: UpdateSupplierGraphQLInput,
): UpdateSupplierInputDto {
  return { ...input, smartThresholds: smartThresholdsInputToDto(input.smartThresholds) };
}

type ResolverResult =
  | BudgetDto
  | BudgetDto[]
  | Record<string, unknown>
  | Record<string, unknown>[]
  | ContractDto
  | DeleteSupplierResultDto
  | null;

let cachedBudgetRepo: DynamoDbBudgetRepository | undefined;
let cachedSupplierRepo: DynamoDbSupplierRepository | undefined;
let cachedContractRepo: DynamoDbContractRepository | undefined;
const idGenerator = new UuidIdGenerator();
const logger = new ConsoleLogger({ source: 'appsync_api_lambda' });

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
        op.args.tenantId,
        op.args.supplierId,
        op.args.budgetId,
      );
      return budget ? BudgetMapper.toDto(budget) : null;
    }

    case 'listBudgetsBySupplier': {
      const list = await budgets().listBySupplier(
        op.args.tenantId,
        op.args.supplierId,
        op.args.limit,
      );
      return list.map((b) => BudgetMapper.toDto(b));
    }

    case 'getSupplier': {
      const supplier = await suppliers().findById(
        op.args.tenantId,
        op.args.supplierId,
      );
      return supplier ? supplierDtoToGraphQL(SupplierMapper.toDto(supplier)) : null;
    }

    case 'listSuppliers': {
      const useCase = new ListSuppliersUseCase({
        supplierRepository: suppliers(),
      });
      const list = await useCase.execute(op.args.tenantId, op.args.limit);
      return list.map((s) => supplierDtoToGraphQL(SupplierMapper.toDto(s)));
    }

    case 'createSupplier': {
      const useCase = new CreateSupplierUseCase({
        supplierRepository: suppliers(),
        idGenerator,
        logger,
      });
      const created = await useCase.execute(adaptCreateInput(op.args.input));
      return supplierDtoToGraphQL(SupplierMapper.toDto(created));
    }

    case 'updateSupplier': {
      const useCase = new UpdateSupplierUseCase({
        supplierRepository: suppliers(),
        logger,
      });
      const updated = await useCase.execute(adaptUpdateInput(op.args.input));
      return supplierDtoToGraphQL(SupplierMapper.toDto(updated));
    }

    case 'deleteSupplier': {
      const useCase = new DeleteSupplierUseCase({
        supplierRepository: suppliers(),
        logger,
      });
      return useCase.execute(op.args.tenantId, op.args.id);
    }

    case 'getContract': {
      const contract = await contracts().findById(
        op.args.tenantId,
        op.args.supplierId,
        op.args.contractId,
      );
      return contract ? ContractMapper.toDto(contract) : null;
    }

    case 'getActiveContract': {
      const at = op.args.at ? new Date(op.args.at) : new Date();
      const contract = await contracts().findActiveBySupplier(
        op.args.tenantId,
        op.args.supplierId,
        at,
      );
      return contract ? ContractMapper.toDto(contract) : null;
    }

    default:
      throw new Error(`Field no soportado: ${event.info.fieldName}`);
  }
};
