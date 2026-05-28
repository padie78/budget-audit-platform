import {
  Budget,
  BudgetExtractionError,
  SupplierNotFoundError,
  type IAiExtractorService,
  type IAuditEventPublisher,
  type IBudgetRepository,
  type IContractRepository,
  type ISupplierRepository,
} from '@budget-audit/domain';
import type { IIdGenerator } from '../../ports/id-generator.port';
import type { ILogger } from '../../ports/logger.port';
import { BudgetMapper } from '../../mappers/budget.mapper';
import type {
  AuditBudgetCommand,
  AuditBudgetResult,
} from './audit-budget.types';

export interface AuditBudgetDependencies {
  supplierRepository: ISupplierRepository;
  contractRepository: IContractRepository;
  budgetRepository: IBudgetRepository;
  aiExtractorService: IAiExtractorService;
  eventPublisher: IAuditEventPublisher;
  idGenerator: IIdGenerator;
  logger: ILogger;
}

/**
 * Caso de uso central de la plataforma. Orquesta:
 *  1. Validación del proveedor.
 *  2. Creación del agregado Budget en estado PROCESSING (idempotencia).
 *  3. Extracción del PDF vía LLM (Structured Outputs).
 *  4. Recuperación del contrato línea base.
 *  5. Auditoría ítem por ítem (delegada al dominio).
 *  6. Persistencia y publicación del evento `onAuditCompleted`.
 *
 * Si algo falla, marca el agregado como FAILED y publica el evento de fallo
 * para que el frontend pueda mostrar feedback al usuario.
 */
export class AuditBudgetUseCase {
  constructor(private readonly deps: AuditBudgetDependencies) {}

  async execute(command: AuditBudgetCommand): Promise<AuditBudgetResult> {
    const { logger } = this.deps;
    const auditId = this.deps.idGenerator.generate();

    logger.info('Audit started', {
      auditId,
      supplierId: command.supplierId,
      s3Url: command.s3Url,
    });

    const supplier = await this.deps.supplierRepository.findById(
      command.supplierId,
    );
    if (!supplier) {
      throw new SupplierNotFoundError(command.supplierId);
    }

    const budget = Budget.initialize({
      id: auditId,
      supplierId: command.supplierId,
      s3Url: command.s3Url,
      contractId: command.contractId ?? null,
    });

    budget.markAsProcessing();
    await this.deps.budgetRepository.save(budget);

    try {
      const extracted = await this.deps.aiExtractorService.extract({
        s3Url: command.s3Url,
        supplierName: supplier.name,
      });

      if (extracted.items.length === 0) {
        throw new BudgetExtractionError(
          'El LLM no identificó ítems en el PDF.',
        );
      }

      const contract = command.contractId
        ? await this.deps.contractRepository.findById(
            command.supplierId,
            command.contractId,
          )
        : await this.deps.contractRepository.findActiveBySupplier(
            command.supplierId,
          );

      budget.auditAgainst(extracted, contract);

      await this.deps.budgetRepository.save(budget);
      await this.deps.eventPublisher.publishAuditCompleted(budget);

      logger.info('Audit completed', {
        auditId,
        alerts: budget.alerts.length,
        redAlerts: budget.alerts.filter((a) => a.severity === 'RED').length,
      });

      return { budget: BudgetMapper.toDto(budget) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Audit failed', { auditId, error: message });

      budget.markAsFailed(message);
      await this.deps.budgetRepository.save(budget);
      await this.deps.eventPublisher.publishAuditFailed(budget);

      throw err;
    }
  }
}
