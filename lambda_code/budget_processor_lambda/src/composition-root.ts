import {
  AuditBudgetUseCase,
  DraftDisputeUseCase,
} from '@budget-audit/application';
import {
  AppSyncEventPublisherAdapter,
  ConsoleLogger,
  DynamoDbBudgetRepository,
  DynamoDbContractRepository,
  DynamoDbSupplierRepository,
  OpenAiBudgetExtractorAdapter,
  OpenAiDisputeWriterAdapter,
  UuidIdGenerator,
} from '@budget-audit/infrastructure';

/**
 * Composition Root: el ÚNICO lugar donde se hace `new` de adaptadores
 * concretos. La función se ejecuta una sola vez por contenedor Lambda
 * (cold start), por lo que las dependencias se reutilizan entre invocaciones.
 */
let cachedAudit: AuditBudgetUseCase | undefined;
let cachedDispute: DraftDisputeUseCase | undefined;

export function buildAuditBudgetUseCase(): AuditBudgetUseCase {
  if (cachedAudit) return cachedAudit;
  const logger = new ConsoleLogger({ service: 'budget-processor-lambda' });

  cachedAudit = new AuditBudgetUseCase({
    supplierRepository: new DynamoDbSupplierRepository(),
    contractRepository: new DynamoDbContractRepository(),
    budgetRepository: new DynamoDbBudgetRepository(),
    aiExtractorService: new OpenAiBudgetExtractorAdapter(),
    eventPublisher: new AppSyncEventPublisherAdapter(),
    idGenerator: new UuidIdGenerator(),
    logger,
  });
  return cachedAudit;
}

export function buildDraftDisputeUseCase(): DraftDisputeUseCase {
  if (cachedDispute) return cachedDispute;
  const logger = new ConsoleLogger({ service: 'budget-processor-lambda:dispute' });
  cachedDispute = new DraftDisputeUseCase({
    supplierRepository: new DynamoDbSupplierRepository(),
    budgetRepository: new DynamoDbBudgetRepository(),
    disputeWriter: new OpenAiDisputeWriterAdapter(),
    logger,
  });
  return cachedDispute;
}
