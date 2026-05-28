export interface AgreedItemDto {
  /** SKU o código del ítem según el catálogo del proveedor. */
  sku: string;
  description: string;
  unit: string;
  /** Precio unitario pactado en moneda base (ej. USD). */
  agreedUnitPrice: number;
  /** Tolerancia (%) aceptada antes de generar alerta. Default 0. */
  tolerancePercent?: number;
}

export interface ContractDto {
  id: string;
  supplierId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currency: string;
  /** Mapa SKU → ítem pactado para lookup O(1) durante la auditoría. */
  agreedItems: Record<string, AgreedItemDto>;
  createdAt: string;
  updatedAt: string;
}
