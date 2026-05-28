import { AuditStatus } from './entity-types';

/**
 * ──────────────────────────────────────────────────────────────────────────
 *  Single-Table Design — Budget Audit Platform (Multitenant)
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  Cada item está aislado por tenant. El `tenantId` es parte de la PK para
 *  garantizar partitioning físico entre tenants y aislamiento de datos
 *  desde el storage.
 *
 *  Tabla principal (PK, SK):
 *    Supplier      → PK = TENANT#<t>#SUPPLIER#<s>  SK = METADATA
 *    Contract base → PK = TENANT#<t>#SUPPLIER#<s>  SK = CONTRACT#<c>
 *    Audit (presup)→ PK = TENANT#<t>#SUPPLIER#<s>  SK = AUDIT#<a>
 *
 *  GSI1 (status-time index, por tenant):
 *    GSI1PK = TENANT#<t>#AUDIT_STATUS#<status>
 *    GSI1SK = <ISO createdAt>
 *    → listar auditorías del tenant en estado X ordenadas por fecha.
 *
 *  Patrones de acceso soportados:
 *    1. Cargar un proveedor por (tenantId, supplierId).
 *    2. Obtener TODO lo de un proveedor (metadata + contratos + auditorías)
 *       con un único Query por PK.
 *    3. Listar contratos vigentes de un proveedor (begins_with SK CONTRACT#).
 *    4. Listar auditorías de un tenant por estado vía GSI1.
 *    5. Listar todos los proveedores del tenant via `begins_with PK
 *       TENANT#<t>#SUPPLIER#` + filter `SK = METADATA`.
 * ──────────────────────────────────────────────────────────────────────────
 */

export const KeyPrefix = {
  Tenant: 'TENANT#',
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

function supplierPK(tenantId: string, supplierId: string): string {
  return `${KeyPrefix.Tenant}${tenantId}#${KeyPrefix.Supplier}${supplierId}`;
}

function tenantSupplierPrefix(tenantId: string): string {
  return `${KeyPrefix.Tenant}${tenantId}#${KeyPrefix.Supplier}`;
}

export const DynamoKeys = {
  supplier(tenantId: string, supplierId: string): SupplierKey {
    return {
      PK: supplierPK(tenantId, supplierId),
      SK: KeyPrefix.Metadata,
    };
  },

  contract(
    tenantId: string,
    supplierId: string,
    contractId: string,
  ): ContractKey {
    return {
      PK: supplierPK(tenantId, supplierId),
      SK: `${KeyPrefix.Contract}${contractId}`,
    };
  },

  audit(
    tenantId: string,
    supplierId: string,
    auditId: string,
    status: AuditStatus,
    createdAt: string,
  ): AuditKey {
    return {
      PK: supplierPK(tenantId, supplierId),
      SK: `${KeyPrefix.Audit}${auditId}`,
      GSI1PK: `${KeyPrefix.Tenant}${tenantId}#${KeyPrefix.AuditStatusGsi}${status}`,
      GSI1SK: createdAt,
    };
  },

  /** PK del nodo SUPPLIER (para Query de un proveedor + sus children). */
  supplierPK,

  /** Prefijo para `begins_with(PK, ...)` en listAll de un tenant. */
  tenantSupplierPrefix,

  /** Prefijos para `begins_with(SK, ...)` en queries por proveedor. */
  contractsBeginsWith(): string {
    return KeyPrefix.Contract;
  },

  auditsBeginsWith(): string {
    return KeyPrefix.Audit;
  },

  /** Parsea `TENANT#<t>#SUPPLIER#<s>` y devuelve {tenantId, supplierId}. */
  parseSupplierPK(pk: string): { tenantId: string; supplierId: string } {
    if (!pk.startsWith(KeyPrefix.Tenant)) {
      throw new Error(`PK no corresponde a un Supplier multitenant: ${pk}`);
    }
    const rest = pk.slice(KeyPrefix.Tenant.length);
    const idx = rest.indexOf(`#${KeyPrefix.Supplier}`);
    if (idx < 0) throw new Error(`PK malformado: ${pk}`);
    return {
      tenantId: rest.slice(0, idx),
      supplierId: rest.slice(idx + 1 + KeyPrefix.Supplier.length),
    };
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
