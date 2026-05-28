import type { Routes } from '@angular/router';
import { ShellLayoutComponent } from './pages/shell-layout/shell-layout.component';
import { BudgetAuditPageComponent } from './pages/budget-audit-page/budget-audit-page.component';
import { SuppliersPortalPageComponent } from './pages/suppliers-portal/suppliers-portal-page.component';

/**
 * Rutas del shell de ProcureTech OS.
 *
 * Todas las features se montan como `children` del `ShellLayoutComponent`,
 * que provee Sidebar + Topbar + `<router-outlet>`. Cada feature concreta
 * solo se encarga de su contenido — no del chrome.
 *
 * Las rutas que todavía no tienen page propia caen al
 * `BudgetAuditPageComponent` como placeholder hasta que se implementen.
 */
export const APP_ROUTES: Routes = [
  {
    path: '',
    component: ShellLayoutComponent,
    children: [
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
          { path: 'suppliers', component: SuppliersPortalPageComponent },
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
    ],
  },
];
