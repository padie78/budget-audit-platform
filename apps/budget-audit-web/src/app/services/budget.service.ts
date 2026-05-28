import { inject, Injectable } from '@angular/core';
import { generateClient, type GraphQLSubscription } from 'aws-amplify/api';
import { from, map, Observable } from 'rxjs';
import type {
  AuditBudgetInput,
  BudgetDto,
  SupplierDto,
} from '@budget-audit/common';
import { TenantContextService } from '../core/tenant/tenant.context';

export interface SignedUploadUrl {
  uploadUrl: string;
  s3Url: string;
  key: string;
  expiresIn: number;
}

interface AuditBudgetResponse {
  auditBudget: BudgetDto;
}
interface SignUploadResponse {
  signUpload: SignedUploadUrl;
}
interface GetBudgetResponse {
  getBudget: BudgetDto | null;
}
interface ListBudgetsResponse {
  listBudgetsBySupplier: BudgetDto[];
}
interface GetSupplierResponse {
  getSupplier: SupplierDto | null;
}
interface OnAuditCompletedResponse {
  onAuditCompleted: BudgetDto;
}

const AUDIT_BUDGET = /* GraphQL */ `
  mutation AuditBudget($input: AuditBudgetInput!) {
    auditBudget(input: $input) {
      tenantId
      id
      supplierId
      contractId
      s3Url
      status
      totalDeviationAmount
      totalDeviationPercent
      errorMessage
      createdAt
      updatedAt
      extractedBudget {
        supplierName
        quoteNumber
        currency
        issuedAt
        totalAmount
        items {
          sku
          description
          unit
          quantity
          unitPrice
          lineTotal
        }
      }
      alerts {
        sku
        description
        agreedUnitPrice
        quotedUnitPrice
        deviationPercent
        severity
        message
      }
    }
  }
`;

const SIGN_UPLOAD = /* GraphQL */ `
  mutation SignUpload($input: SignUploadInput!) {
    signUpload(input: $input) {
      uploadUrl
      s3Url
      key
      expiresIn
    }
  }
`;

const GET_BUDGET = /* GraphQL */ `
  query GetBudget($tenantId: ID!, $supplierId: ID!, $budgetId: ID!) {
    getBudget(tenantId: $tenantId, supplierId: $supplierId, budgetId: $budgetId) {
      tenantId
      id
      status
      totalDeviationAmount
      totalDeviationPercent
      alerts {
        sku
        severity
        deviationPercent
      }
    }
  }
`;

const LIST_BUDGETS = /* GraphQL */ `
  query ListBudgetsBySupplier($tenantId: ID!, $supplierId: ID!, $limit: Int) {
    listBudgetsBySupplier(
      tenantId: $tenantId
      supplierId: $supplierId
      limit: $limit
    ) {
      tenantId
      id
      status
      createdAt
      totalDeviationAmount
      totalDeviationPercent
    }
  }
`;

const GET_SUPPLIER = /* GraphQL */ `
  query GetSupplier($tenantId: ID!, $supplierId: ID!) {
    getSupplier(tenantId: $tenantId, supplierId: $supplierId) {
      tenantId
      id
      name
      taxId
      contactEmail
      createdAt
      updatedAt
    }
  }
`;

const ON_AUDIT_COMPLETED = /* GraphQL */ `
  subscription OnAuditCompleted($tenantId: ID!, $supplierId: ID!) {
    onAuditCompleted(tenantId: $tenantId, supplierId: $supplierId) {
      tenantId
      id
      supplierId
      status
      totalDeviationAmount
      totalDeviationPercent
      extractedBudget {
        supplierName
        currency
        totalAmount
        items {
          sku
          description
          quantity
          unitPrice
          lineTotal
        }
      }
      alerts {
        sku
        description
        agreedUnitPrice
        quotedUnitPrice
        deviationPercent
        severity
        message
      }
      updatedAt
    }
  }
`;

/**
 * Único punto de contacto del frontend con AppSync. Centraliza queries,
 * mutations y subscriptions. Los componentes UI nunca usan el cliente
 * GraphQL directamente: hablan con este servicio mediante Observables.
 *
 * Multitenant: el tenant actual viaja como argumento explícito en cada
 * operación, resuelto desde `TenantContextService`.
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly client = generateClient();
  private readonly tenantCtx = inject(TenantContextService);

  auditBudget(
    input: Omit<AuditBudgetInput, 'tenantId'>,
  ): Observable<BudgetDto> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<AuditBudgetResponse>({
        query: AUDIT_BUDGET,
        variables: { input: { ...input, tenantId } },
      }),
    ).pipe(map((res) => res.data.auditBudget));
  }

  signUpload(input: {
    supplierId: string;
    fileName: string;
    contentType: string;
  }): Observable<SignedUploadUrl> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<SignUploadResponse>({
        query: SIGN_UPLOAD,
        variables: { input: { ...input, tenantId } },
      }),
    ).pipe(map((res) => res.data.signUpload));
  }

  getBudget(supplierId: string, budgetId: string): Observable<BudgetDto | null> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<GetBudgetResponse>({
        query: GET_BUDGET,
        variables: { tenantId, supplierId, budgetId },
      }),
    ).pipe(map((res) => res.data.getBudget));
  }

  listBudgetsBySupplier(
    supplierId: string,
    limit = 50,
  ): Observable<BudgetDto[]> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<ListBudgetsResponse>({
        query: LIST_BUDGETS,
        variables: { tenantId, supplierId, limit },
      }),
    ).pipe(map((res) => res.data.listBudgetsBySupplier));
  }

  getSupplier(supplierId: string): Observable<SupplierDto | null> {
    const tenantId = this.tenantCtx.current();
    return from(
      this.client.graphql<GetSupplierResponse>({
        query: GET_SUPPLIER,
        variables: { tenantId, supplierId },
      }),
    ).pipe(map((res) => res.data.getSupplier));
  }

  /**
   * Stream en tiempo real: la Lambda dispara `publishAuditCompleted` al
   * terminar y AppSync nos despierta aquí. El componente Feature traduce
   * cada emisión a estado de la vista.
   */
  onAuditCompleted(supplierId: string): Observable<BudgetDto> {
    const tenantId = this.tenantCtx.current();
    const observable = this.client.graphql<
      GraphQLSubscription<OnAuditCompletedResponse>
    >({
      query: ON_AUDIT_COMPLETED,
      variables: { tenantId, supplierId },
    });

    return new Observable<BudgetDto>((subscriber) => {
      const sub = (
        observable as unknown as {
          subscribe: (handlers: {
            next: (msg: { data?: OnAuditCompletedResponse }) => void;
            error: (e: unknown) => void;
            complete?: () => void;
          }) => { unsubscribe: () => void };
        }
      ).subscribe({
        next: (msg) => {
          const budget = msg.data?.onAuditCompleted;
          if (budget) subscriber.next(budget);
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      return () => sub.unsubscribe();
    });
  }
}
