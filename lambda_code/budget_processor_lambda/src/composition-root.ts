import { AuditBudgetUseCase } from '@budget-audit/application';
import {
  AppSyncEventPublisherAdapter,
  ConsoleLogger,
  DynamoDbBudgetRepository,
  DynamoDbContractRepository,
  DynamoDbSupplierRepository,
  OpenAiBudgetExtractorAdapter,
  UuidIdGenerator,
} from '@budget-audit/infrastructure';

/**
 * Composition Root: el ÚNICO lugar donde se hace `new` de adaptadores
 * concretos. La función se ejecuta una sola vez por contenedor Lambda
 * (cold start), por lo que las dependencias se reutilizan entre invocaciones.
 */
let cachedUseCase: AuditBudgetUseCase | undefined;

export function buildAuditBudgetUseCase(): AuditBudgetUseCase {
  if (cachedUseCase) return cachedUseCase;

  const logger = new ConsoleLogger({ service: 'budget-processor-lambda' });

  cachedUseCase = new AuditBudgetUseCase({
    supplierRepository: new DynamoDbSupplierRepository(),
    contractRepository: new DynamoDbContractRepository(),
    budgetRepository: new DynamoDbBudgetRepository(),
    aiExtractorService: new OpenAiBudgetExtractorAdapter(),
    eventPublisher: new AppSyncEventPublisherAdapter(),
    idGenerator: new UuidIdGenerator(),
    logger,
  });

  return cachedUseCase;
}
