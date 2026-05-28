import { v4 as uuidv4 } from 'uuid';
import type { IIdGenerator } from '@budget-audit/application';

export class UuidIdGenerator implements IIdGenerator {
  generate(): string {
    return uuidv4();
  }
}
