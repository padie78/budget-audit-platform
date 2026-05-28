import { inject, Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { from, map, Observable } from 'rxjs';
import type {
  CreateSupplierInputDto,
  DeleteSupplierResultDto,
  SupplierDto,
  UpdateSupplierInputDto,
} from '@budget-audit/common';
import { TenantContextService } from '../core/tenant/tenant.context';

/* =============================================================================
 * SupplierService — único punto de contacto del Portal de Proveedores con
 * AppSync. Encapsula queries/mutations GraphQL y normaliza el shape de
 * `smartThresholds.categories` (lista de entries en GraphQL ↔ Record local).
 *
 * Multitenant: cada request incluye `tenantId` resuelto desde
 * `TenantContextService`. Cuando se incorpore Cognito, el tenant podrá viajar
 * en el JWT y los args explícitos se reemplazarán por claims.
 * ============================================================================= */

interface SmartThresholdCategoryEntry {
  category: string;
  tolerancePercentage: number;
}

interface SupplierGraphQL extends Omit<SupplierDto, 'smartThresholds'> {
  smartThresholds?: {
    defaultTolerancePercentage: number;
    categories: SmartThresholdCategoryEntry[];
  };
}

interface ListSuppliersResponse {
  listSuppliers: SupplierGraphQL[];
}
interface CreateSupplierResponse {
  createSupplier: SupplierGraphQL;
}
interface UpdateSupplierResponse {
  updateSupplier: SupplierGraphQL;
}
interface DeleteSupplierResponse {
  deleteSupplier: DeleteSupplierResultDto;
}
interface GetSupplierResponse {
  getSupplier: SupplierGraphQL | null;
}

/* ────────────────── Operaciones GraphQL ────────────────── */

const SUPPLIER_FIELDS = /* GraphQL */ `
  tenantId
  entityId
  versionId
  id
  name
  taxId
  contactEmail
  fidelityScore
  thresholdPolicy {
    percentTolerance
    absoluteTolerance
    autoApprovalUpTo
    currency
  }
  contactInfo {
    email
    phone
    address
  }
  vendorPerformance {
    reliabilityScore
    totalAuditedDocs
    totalDisputesRaised
    averageDisputeResolutionDays
    slaDeliveryComplianceRate
    trend
    onboardingStatus
  }
  strategicIntelligence {
    riskProfile {
      score
      level
      lastCheck
    }
    paymentStrategy {
      earlyPaymentPreferred
      discountTargetPercentage
    }
    diversityStatus
    criticalityIndex
  }
  smartThresholds {
    defaultTolerancePercentage
    categories {
      category
      tolerancePercentage
    }
  }
  complianceAndRisk {
    status
    lastAuditDate
    certifications
    esgComplianceScore
    primarySectorCode
  }
  createdAt
  updatedAt
`;

const LIST_SUPPLIERS = /* GraphQL */ `
  query ListSuppliers($tenantId: ID!, $limit: Int) {
    listSuppliers(tenantId: $tenantId, limit: $limit) {
      ${SUPPLIER_FIELDS}
    }
  }
`;

const GET_SUPPLIER = /* GraphQL */ `
  query GetSupplier($tenantId: ID!, $supplierId: ID!) {
    getSupplier(tenantId: $tenantId, supplierId: $supplierId) {
      ${SUPPLIER_FIELDS}
    }
  }
`;

const CREATE_SUPPLIER = /* GraphQL */ `
  mutation CreateSupplier($input: CreateSupplierInput!) {
    createSupplier(input: $input) {
      ${SUPPLIER_FIELDS}
    }
  }
`;

const UPDATE_SUPPLIER = /* GraphQL */ `
  mutation UpdateSupplier($input: UpdateSupplierInput!) {
    updateSupplier(input: $input) {
      ${SUPPLIER_FIELDS}
    }
  }
`;

const DELETE_SUPPLIER = /* GraphQL */ `
  mutation DeleteSupplier($tenantId: ID!, $id: ID!) {
    deleteSupplier(tenantId: $tenantId, id: $id) {
      tenantId
      id
      deleted
    }
  }
`;

/* ────────────────── Adapters ────────────────── */

function normalizeSupplier(s: SupplierGraphQL): SupplierDto {
  return {
    ...s,
    smartThresholds: s.smartThresholds
      ? {
          defaultTolerancePercentage: s.smartThresholds.defaultTolerancePercentage,
          categories: Object.fromEntries(
            s.smartThresholds.categories.map((e) => [
              e.category,
              e.tolerancePercentage,
            ]),
          ),
        }
      : undefined,
  };
}

/** Convierte el input del UI (Record) al shape esperado por AppSync (lista). */
function denormalizeInput<
  T extends {
    smartThresholds?: {
      defaultTolerancePercentage: number;
      categories: Record<string, number>;
    };
  },
>(
  input: T,
): Omit<T, 'smartThresholds'> & {
  smartThresholds?: {
    defaultTolerancePercentage: number;
    categories: SmartThresholdCategoryEntry[];
  };
} {
  if (!input.smartThresholds) {
    const { smartThresholds: _ignored, ...rest } = input;
    return { ...rest };
  }
  const { smartThresholds, ...rest } = input;
  return {
    ...rest,
    smartThresholds: {
      defaultTolerancePercentage: smartThresholds.defaultTolerancePercentage,
      categories: Object.entries(smartThresholds.categories).map(
        ([category, tolerancePercentage]) => ({
          category,
          tolerancePercentage,
        }),
      ),
    },
  };
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly client = generateClient();
  private readonly tenantCtx = inject(TenantContextService);

  listSuppliers(limit = 100): Observable<SupplierDto[]> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<ListSuppliersResponse>({
        query: LIST_SUPPLIERS,
        variables: { tenantId, limit },
      }),
    ).pipe(map((res) => res.data.listSuppliers.map(normalizeSupplier)));
  }

  getSupplier(supplierId: string): Observable<SupplierDto | null> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<GetSupplierResponse>({
        query: GET_SUPPLIER,
        variables: { tenantId, supplierId },
      }),
    ).pipe(
      map((res) =>
        res.data.getSupplier ? normalizeSupplier(res.data.getSupplier) : null,
      ),
    );
  }

  createSupplier(
    input: Omit<CreateSupplierInputDto, 'tenantId'>,
  ): Observable<SupplierDto> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<CreateSupplierResponse>({
        query: CREATE_SUPPLIER,
        variables: { input: denormalizeInput({ ...input, tenantId }) },
      }),
    ).pipe(map((res) => normalizeSupplier(res.data.createSupplier)));
  }

  updateSupplier(
    input: Omit<UpdateSupplierInputDto, 'tenantId'>,
  ): Observable<SupplierDto> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<UpdateSupplierResponse>({
        query: UPDATE_SUPPLIER,
        variables: { input: denormalizeInput({ ...input, tenantId }) },
      }),
    ).pipe(map((res) => normalizeSupplier(res.data.updateSupplier)));
  }

  deleteSupplier(id: string): Observable<DeleteSupplierResultDto> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<DeleteSupplierResponse>({
        query: DELETE_SUPPLIER,
        variables: { tenantId, id },
      }),
    ).pipe(map((res) => res.data.deleteSupplier));
  }
}
