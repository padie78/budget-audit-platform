export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SupplierNotFoundError extends DomainError {
  constructor(supplierId: string) {
    super(`Proveedor no encontrado: ${supplierId}`);
  }
}

export class ContractNotFoundError extends DomainError {
  constructor(supplierId: string) {
    super(`No existe contrato línea base para el proveedor ${supplierId}`);
  }
}

export class BudgetExtractionError extends DomainError {
  constructor(reason: string) {
    super(`Extracción de presupuesto fallida: ${reason}`);
  }
}
