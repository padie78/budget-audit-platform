export interface IIdGenerator {
  generate(): string;
}

export const ID_GENERATOR = Symbol('IIdGenerator');
