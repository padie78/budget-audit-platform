import type { Budget } from '../entities/budget';
import type { Supplier } from '../entities/supplier';
import type { DisputeEmail } from '../value-objects/dispute-email';

export interface IDisputeWriterService {
  draft(input: { budget: Budget; supplier: Supplier }): Promise<DisputeEmail>;
}

export const DISPUTE_WRITER_SERVICE = Symbol('IDisputeWriterService');
