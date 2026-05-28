import type { Routes } from '@angular/router';
import { BudgetAuditPageComponent } from './pages/budget-audit-page/budget-audit-page.component';

/**
 * Rutas placeholder del shell de ProcureTech OS.
 *
 * Todas las entradas resuelven al `BudgetAuditPageComponent` hasta que se
 * implementen las features reales. Garantizan que el `Router` esté en el
 * injector (necesario para que `p-menu` / `p-panelMenu` puedan renderizar
 * items con `routerLink`) y que ninguna navegación rompa.
 *
 * Sustituir cada `component: BudgetAuditPageComponent` por la page real
 * conforme se vaya implementando.
 */
export const APP_ROUTES: Routes = [
  { path: '', redirectTo: 'analytics/dashboard', pathMatch: 'full' },

  {
    path: 'analytics',
    children: [
      { path: 'dashboard', component: BudgetAuditPageComponent },
      { path: 'cashflow-forecast', component: BudgetAuditPageComponent },
    ],
  },
  {
    path: 'audits',
    children: [
      { path: 'three-way-matching', component: BudgetAuditPageComponent },
    ],
  },
  {
    path: 'ai',
    children: [{ path: 'copilot', component: BudgetAuditPageComponent }],
  },
  {
    path: 'operations',
    children: [
      { path: 'purchase-orders', component: BudgetAuditPageComponent },
      { path: 'history', component: BudgetAuditPageComponent },
    ],
  },
  {
    path: 'masters',
    children: [
      { path: 'suppliers', component: BudgetAuditPageComponent },
      { path: 'contracts', component: BudgetAuditPageComponent },
      { path: 'renewals', component: BudgetAuditPageComponent },
    ],
  },
  {
    path: 'compliance',
    children: [
      { path: 'legal-auditor', component: BudgetAuditPageComponent },
      { path: 'disputes', component: BudgetAuditPageComponent },
    ],
  },
  {
    path: 'settings',
    children: [
      { path: 'thresholds', component: BudgetAuditPageComponent },
      { path: 'integrations', component: BudgetAuditPageComponent },
      { path: '', redirectTo: 'thresholds', pathMatch: 'full' },
    ],
  },

  // Topbar user menu
  { path: 'profile', component: BudgetAuditPageComponent },
  { path: 'support', component: BudgetAuditPageComponent },

  { path: '**', redirectTo: 'analytics/dashboard' },
];
