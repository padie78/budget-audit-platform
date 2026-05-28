import {
  ContractNotFoundError,
  SupplierNotFoundError,
  type IBudgetRepository,
  type IDisputeWriterService,
  type ISupplierRepository,
} from '@budget-audit/domain';
import type { DisputeEmailDto } from '@budget-audit/common';
import type { ILogger } from '../../ports/logger.port';

export interface DraftDisputeCommand {
  tenantId: string;
  supplierId: string;
  budgetId: string;
}

export interface DraftDisputeResult {
  email: DisputeEmailDto;
}

export interface DraftDisputeDependencies {
  supplierRepository: ISupplierRepository;
  budgetRepository: IBudgetRepository;
  disputeWriter: IDisputeWriterService;
  logger: ILogger;
}

/**
 * AI Dispute Workflow: dado un Budget ya auditado con desvíos, genera el
 * correo formal de reclamo al proveedor. La IA lee discrepancias y riesgos
 * legales y arma el body. El frontend lo presenta en un modal de revisión.
 */
export class DraftDisputeUseCase {
  constructor(private readonly deps: DraftDisputeDependencies) {}

  async execute(command: DraftDisputeCommand): Promise<DraftDisputeResult> {
    if (!command.tenantId?.trim()) {
      throw new Error('tenantId es obligatorio en DraftDisputeCommand.');
    }

    const supplier = await this.deps.supplierRepository.findById(
      command.tenantId,
      command.supplierId,
    );
    if (!supplier) throw new SupplierNotFoundError(command.supplierId);

    const budget = await this.deps.budgetRepository.findById(
      command.tenantId,
      command.supplierId,
      command.budgetId,
    );
    if (!budget) throw new ContractNotFoundError(command.supplierId);

    this.deps.logger.info('Drafting dispute email', {
      tenantId: command.tenantId,
      supplierId: command.supplierId,
      budgetId: command.budgetId,
    });

    const email = await this.deps.disputeWriter.draft({ budget, supplier });

    return {
      email: {
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        body: email.body,
        highlightedPoints: email.highlightedPoints,
        attachmentUrl: email.attachmentUrl,
        draftedAt: email.draftedAt.toISOString(),
      },
    };
  }
}
