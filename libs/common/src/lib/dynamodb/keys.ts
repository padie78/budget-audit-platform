import { AuditStatus } from './entity-types';

/**
 * ──────────────────────────────────────────────────────────────────────────
 *  Single-Table Design — Budget Audit Platform
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  Tabla principal (PK, SK):
 *    Supplier          → PK = SUPPLIER#<supplierId>  SK = METADATA
 *    Contract base     → PK = SUPPLIER#<supplierId>  SK = CONTRACT#<contractId>
 *    Audit (presup.)   → PK = SUPPLIER#<supplierId>  SK = AUDIT#<auditId>
 *
 *  GSI1 (status-time index):
 *    GSI1PK = AUDIT_STATUS#<status>   GSI1SK = <ISO createdAt>
 *    → permite listar todas las auditorías en estado X ordenadas por fecha.
 *
 *  Patrones de acceso soportados:
 *    1. Cargar un proveedor por id.
 *    2. Obtener TODO lo relacionado con un proveedor (metadata + contratos
 *       + auditorías) con un único Query por PK.
 *    3. Obtener el último contrato vigente: Query PK=SUPPLIER#x,
 *       SK begins_with CONTRACT#.
 *    4. Listar auditorías por estado (PENDING, COMPLETED) en orden temporal
 *       desde el GSI1.
 * ──────────────────────────────────────────────────────────────────────────
 */

export const KeyPrefix = {
  Supplier: 'SUPPLIER#',
  Contract: 'CONTRACT#',
  Audit: 'AUDIT#',
  Metadata: 'METADATA',
  AuditStatusGsi: 'AUDIT_STATUS#',
} as const;

export interface SupplierKey {
  PK: string;
  SK: string;
}

export interface ContractKey {
  PK: string;
  SK: string;
}

export interface AuditKey {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

export const DynamoKeys = {
  supplier(supplierId: string): SupplierKey {
    return {
      PK: `${KeyPrefix.Supplier}${supplierId}`,
      SK: KeyPrefix.Metadata,
    };
  },

  contract(supplierId: string, contractId: string): ContractKey {
    return {
      PK: `${KeyPrefix.Supplier}${supplierId}`,
      SK: `${KeyPrefix.Contract}${contractId}`,
    };
  },

  audit(
    supplierId: string,
    auditId: string,
    status: AuditStatus,
    createdAt: string
  ): AuditKey {
    return {
      PK: `${KeyPrefix.Supplier}${supplierId}`,
      SK: `${KeyPrefix.Audit}${auditId}`,
      GSI1PK: `${KeyPrefix.AuditStatusGsi}${status}`,
      GSI1SK: createdAt,
    };
  },

  /** Devuelve los parámetros para hacer `begins_with` en queries. */
  contractsBeginsWith(): string {
    return KeyPrefix.Contract;
  },

  auditsBeginsWith(): string {
    return KeyPrefix.Audit;
  },

  parseSupplierId(pk: string): string {
    if (!pk.startsWith(KeyPrefix.Supplier)) {
      throw new Error(`PK no corresponde a un Supplier: ${pk}`);
    }
    return pk.slice(KeyPrefix.Supplier.length);
  },

  parseContractId(sk: string): string {
    if (!sk.startsWith(KeyPrefix.Contract)) {
      throw new Error(`SK no corresponde a un Contract: ${sk}`);
    }
    return sk.slice(KeyPrefix.Contract.length);
  },

  parseAuditId(sk: string): string {
    if (!sk.startsWith(KeyPrefix.Audit)) {
      throw new Error(`SK no corresponde a un Audit: ${sk}`);
    }
    return sk.slice(KeyPrefix.Audit.length);
  },
} as const;
