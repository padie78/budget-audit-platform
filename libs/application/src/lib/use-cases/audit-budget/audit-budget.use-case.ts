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
import { computeThreeWayMatch } from './three-way-matcher';
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
 * Caso de uso enterprise. Orquesta el ciclo completo:
 *
 *   1. Valida proveedor y carga su política de Smart Thresholds.
 *   2. Marca el agregado como PROCESSING (persistencia idempotente).
 *   3. Llama al LLM para extraer la cotización principal + riesgos legales.
 *   4. Si vienen OC y/o Factura, las extrae también y ejecuta Three-Way
 *      Matching contra el contrato.
 *   5. Recupera el contrato línea base.
 *   6. Delega la auditoría al agregado: discrepancias, decisión automática
 *      (auto-approved/requires-review) y cash flow forecast.
 *   7. Persiste y publica `onAuditCompleted` para que el frontend reaccione.
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
      hasPo: !!command.poS3Url,
      hasInvoice: !!command.invoiceS3Url,
    });

    const supplier = await this.deps.supplierRepository.findById(command.supplierId);
    if (!supplier) throw new SupplierNotFoundError(command.supplierId);

    const budget = Budget.initialize({
      id: auditId,
      supplierId: command.supplierId,
      s3Url: command.s3Url,
      contractId: command.contractId ?? null,
    });

    budget.markAsProcessing();
    await this.deps.budgetRepository.save(budget);

    try {
      const main = await this.deps.aiExtractorService.extract({
        s3Url: command.s3Url,
        supplierName: supplier.name,
        documentKind: command.invoiceS3Url ? 'INVOICE' : 'QUOTE',
      });

      if (main.budget.items.length === 0) {
        throw new BudgetExtractionError('El LLM no identificó ítems en el documento principal.');
      }

      const contract = command.contractId
        ? await this.deps.contractRepository.findById(command.supplierId, command.contractId)
        : await this.deps.contractRepository.findActiveBySupplier(command.supplierId);

      const purchaseOrder = command.poS3Url
        ? (await this.deps.aiExtractorService.extract({
            s3Url: command.poS3Url,
            supplierName: supplier.name,
            documentKind: 'PURCHASE_ORDER',
          })).budget
        : null;

      const threeWayMatch =
        command.invoiceS3Url || command.poS3Url
          ? computeThreeWayMatch({
              contract,
              purchaseOrder,
              invoice: main.budget,
              currency: main.budget.currency,
            })
          : null;

      const cashFlowInput =
        command.projectDurationMonths !== undefined && command.elapsedMonths !== undefined
          ? {
              contractValue: main.budget.totalAmount,
              projectDurationMonths: command.projectDurationMonths,
              elapsedMonths: command.elapsedMonths,
            }
          : undefined;

      budget.auditAgainst({
        extracted: main.budget,
        contract,
        policy: supplier.thresholdPolicy,
        legalRisks: main.legalRisks,
        threeWayMatch,
        cashFlowInput,
      });

      await this.deps.budgetRepository.save(budget);
      await this.deps.eventPublisher.publishAuditCompleted(budget);

      logger.info('Audit completed', {
        auditId,
        decision: budget.decision,
        discrepancies: budget.discrepancies.length,
        redLegalRisks: budget.legalRisks.filter((r) => r.severity === 'RED').length,
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
