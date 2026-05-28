import { Injectable } from '@angular/core';
import { generateClient, type GraphQLSubscription } from 'aws-amplify/api';
import { from, map, Observable } from 'rxjs';
import type {
  AuditBudgetInput,
  BudgetDto,
  SupplierDto,
} from '@budget-audit/common';

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
  query GetBudget($supplierId: ID!, $budgetId: ID!) {
    getBudget(supplierId: $supplierId, budgetId: $budgetId) {
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
  query ListBudgetsBySupplier($supplierId: ID!, $limit: Int) {
    listBudgetsBySupplier(supplierId: $supplierId, limit: $limit) {
      id
      status
      createdAt
      totalDeviationAmount
      totalDeviationPercent
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
      createdAt
      updatedAt
    }
  }
`;

const ON_AUDIT_COMPLETED = /* GraphQL */ `
  subscription OnAuditCompleted($supplierId: ID!) {
    onAuditCompleted(supplierId: $supplierId) {
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
 */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly client = generateClient();

  auditBudget(input: AuditBudgetInput): Observable<BudgetDto> {
    return from(
      this.client.graphql<AuditBudgetResponse>({
        query: AUDIT_BUDGET,
        variables: { input },
      }),
    ).pipe(map((res) => res.data.auditBudget));
  }

  signUpload(input: {
    supplierId: string;
    fileName: string;
    contentType: string;
  }): Observable<SignedUploadUrl> {
    return from(
      this.client.graphql<SignUploadResponse>({
        query: SIGN_UPLOAD,
        variables: { input },
      }),
    ).pipe(map((res) => res.data.signUpload));
  }

  getBudget(supplierId: string, budgetId: string): Observable<BudgetDto | null> {
    return from(
      this.client.graphql<GetBudgetResponse>({
        query: GET_BUDGET,
        variables: { supplierId, budgetId },
      }),
    ).pipe(map((res) => res.data.getBudget));
  }

  listBudgetsBySupplier(supplierId: string, limit = 50): Observable<BudgetDto[]> {
    return from(
      this.client.graphql<ListBudgetsResponse>({
        query: LIST_BUDGETS,
        variables: { supplierId, limit },
      }),
    ).pipe(map((res) => res.data.listBudgetsBySupplier));
  }

  getSupplier(supplierId: string): Observable<SupplierDto | null> {
    return from(
      this.client.graphql<GetSupplierResponse>({
        query: GET_SUPPLIER,
        variables: { supplierId },
      }),
    ).pipe(map((res) => res.data.getSupplier));
  }

  /**
   * Stream en tiempo real: la Lambda dispara `publishAuditCompleted` al
   * terminar y AppSync nos despierta aquí. El componente Feature traduce
   * cada emisión a estado de la vista.
   */
  onAuditCompleted(supplierId: string): Observable<BudgetDto> {
    const observable = this.client.graphql<
      GraphQLSubscription<OnAuditCompletedResponse>
    >({
      query: ON_AUDIT_COMPLETED,
      variables: { supplierId },
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
