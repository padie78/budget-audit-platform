import { Injectable, computed, signal } from '@angular/core';

/* =============================================================================
 * TenantContextService — fuente única de verdad del tenant actual.
 *
 * Hoy el tenant viaja como argumento explícito en todas las queries/mutations
 * de AppSync. Cuando se incorpore Cognito reemplazaremos `currentTenantId` por
 * un selector sobre los claims del JWT, sin tocar la capa de servicios ni
 * los components.
 *
 * Para entornos locales / demo el tenantId arranca con un valor por defecto
 * (configurable vía localStorage `tenantId` o env `DEFAULT_TENANT_ID`).
 * ============================================================================= */
const STORAGE_KEY = 'tenantId';
const DEFAULT_TENANT_ID = 'demo-tenant-acme';

@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly _tenantId = signal<string>(this.bootstrapTenantId());

  /** Tenant actual como signal reactivo (consumible en templates/computed). */
  readonly tenantId = computed(() => this._tenantId());

  /** Tenant snapshot para llamados imperativos (services GraphQL, fetch). */
  current(): string {
    return this._tenantId();
  }

  /** Permite cambiar de tenant (impersonation, demo, switcher en UI). */
  switchTo(tenantId: string): void {
    const id = tenantId.trim();
    if (!id) throw new Error('tenantId no puede ser vacío.');
    this._tenantId.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage no disponible (SSR/private mode) — está OK.
    }
  }

  private bootstrapTenantId(): string {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored?.trim()) return stored.trim();
    } catch {
      // ignore
    }
    return DEFAULT_TENANT_ID;
  }
}
