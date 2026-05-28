import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/api';
import { from, map, Observable } from 'rxjs';
import type {
  CreateSupplierInputDto,
  DeleteSupplierResultDto,
  SupplierDto,
  UpdateSupplierInputDto,
} from '@budget-audit/common';

/* =============================================================================
 * SupplierService — único punto de contacto del Portal de Proveedores con
 * AppSync. Encapsula queries/mutations GraphQL y normaliza el shape de
 * `smartThresholds.categories` (lista de entries en GraphQL ↔ Record local).
 * ============================================================================= */

/** Shape de `smartThresholds.categories` tal como la transmite AppSync. */
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

const LIST_SUPPLIERS = /* GraphQL */ `
  query ListSuppliers($limit: Int) {
    listSuppliers(limit: $limit) {
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
      createdAt
      updatedAt
    }
  }
`;

const GET_SUPPLIER = /* GraphQL */ `
  query GetSupplier($supplierId: ID!) {
    getSupplier(supplierId: $supplierId) {
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
      createdAt
      updatedAt
    }
  }
`;

const CREATE_SUPPLIER = /* GraphQL */ `
  mutation CreateSupplier($input: CreateSupplierInput!) {
    createSupplier(input: $input) {
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
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_SUPPLIER = /* GraphQL */ `
  mutation UpdateSupplier($input: UpdateSupplierInput!) {
    updateSupplier(input: $input) {
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
      createdAt
      updatedAt
    }
  }
`;

const DELETE_SUPPLIER = /* GraphQL */ `
  mutation DeleteSupplier($id: ID!) {
    deleteSupplier(id: $id) {
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
function denormalizeInput<T extends { smartThresholds?: { defaultTolerancePercentage: number; categories: Record<string, number> } }>(
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

  listSuppliers(limit = 100): Observable<SupplierDto[]> {
    return from(
      this.client.graphql<ListSuppliersResponse>({
        query: LIST_SUPPLIERS,
        variables: { limit },
      }),
    ).pipe(
      map((res) => res.data.listSuppliers.map(normalizeSupplier)),
    );
  }

  getSupplier(supplierId: string): Observable<SupplierDto | null> {
    return from(
      this.client.graphql<GetSupplierResponse>({
        query: GET_SUPPLIER,
        variables: { supplierId },
      }),
    ).pipe(
      map((res) =>
        res.data.getSupplier ? normalizeSupplier(res.data.getSupplier) : null,
      ),
    );
  }

  createSupplier(input: CreateSupplierInputDto): Observable<SupplierDto> {
    return from(
      this.client.graphql<CreateSupplierResponse>({
        query: CREATE_SUPPLIER,
        variables: { input: denormalizeInput(input) },
      }),
    ).pipe(map((res) => normalizeSupplier(res.data.createSupplier)));
  }

  updateSupplier(input: UpdateSupplierInputDto): Observable<SupplierDto> {
    return from(
      this.client.graphql<UpdateSupplierResponse>({
        query: UPDATE_SUPPLIER,
        variables: { input: denormalizeInput(input) },
      }),
    ).pipe(map((res) => normalizeSupplier(res.data.updateSupplier)));
  }

  deleteSupplier(id: string): Observable<DeleteSupplierResultDto> {
    return from(
      this.client.graphql<DeleteSupplierResponse>({
        query: DELETE_SUPPLIER,
        variables: { id },
      }),
    ).pipe(map((res) => res.data.deleteSupplier));
  }
}
