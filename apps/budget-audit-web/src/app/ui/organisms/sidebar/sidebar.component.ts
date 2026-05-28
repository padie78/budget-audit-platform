import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PanelMenuModule } from 'primeng/panelmenu';
import { BadgeModule } from 'primeng/badge';
import { PrimeTemplate, type MenuItem } from 'primeng/api';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    PanelMenuModule,
    BadgeModule,
    PrimeTemplate,
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  readonly pendingAuditsCount = input<number>(7);
  readonly legalRisksCount = input<number>(3);
  readonly userName = input<string>('Diego Liascovich');
  readonly userRole = input<string>('Senior Backend & Cloud Admin');

  protected readonly initials = computed(() =>
    this.userName()
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
  );

  protected readonly items = computed<MenuItem[]>(() => [
    {
      label: 'Control Central',
      icon: 'pi pi-th-large',
      expanded: true,
      items: [
        {
          label: 'Dashboard Ejecutivo',
          icon: 'pi pi-home',
          routerLink: ['/analytics/dashboard'],
        },
      ],
    },
    {
      label: 'Operaciones Diarias',
      icon: 'pi pi-shopping-cart',
      expanded: true,
      items: [
        {
          label: 'Conciliación de 3 Vías',
          icon: 'pi pi-clone',
          routerLink: ['/audits/three-way-matching'],
          badge:
            this.pendingAuditsCount() > 0
              ? String(this.pendingAuditsCount())
              : undefined,
          badgeStyleClass: 'p-badge-danger',
        },
        {
          label: 'Copiloto AI (Chat)',
          icon: 'pi pi-sparkles',
          routerLink: ['/ai/copilot'],
        },
        {
          label: 'Órdenes de Compra',
          icon: 'pi pi-receipt',
          routerLink: ['/operations/purchase-orders'],
        },
        {
          label: 'Historial de Auditorías',
          icon: 'pi pi-history',
          routerLink: ['/operations/history'],
        },
      ],
    },
    {
      label: 'Gestión de Maestros',
      icon: 'pi pi-briefcase',
      items: [
        {
          label: 'Portal de Proveedores',
          icon: 'pi pi-id-card',
          routerLink: ['/masters/suppliers'],
        },
        {
          label: 'Contratos Marco & Tarifarios',
          icon: 'pi pi-book',
          routerLink: ['/masters/contracts'],
        },
        {
          label: 'Renovaciones y Alertas',
          icon: 'pi pi-calendar',
          routerLink: ['/masters/renewals'],
        },
      ],
    },
    {
      label: 'Módulos de Inteligencia (AI)',
      icon: 'pi pi-chart-bar',
      items: [
        {
          label: 'Auditoría Legal y Cláusulas',
          icon: 'pi pi-shield',
          routerLink: ['/compliance/legal-auditor'],
          badge:
            this.legalRisksCount() > 0
              ? String(this.legalRisksCount())
              : undefined,
          badgeStyleClass: 'p-badge-warning',
        },
        {
          label: 'Proyecciones de Caja (CFO)',
          icon: 'pi pi-chart-line',
          routerLink: ['/analytics/cashflow-forecast'],
        },
        {
          label: 'Centro de Disputas AI',
          icon: 'pi pi-send',
          routerLink: ['/compliance/disputes'],
        },
      ],
    },
    {
      label: 'Configuración de Sistema',
      icon: 'pi pi-cog',
      items: [
        {
          label: 'Umbrales de Tolerancia',
          icon: 'pi pi-sliders-h',
          routerLink: ['/settings/thresholds'],
        },
        {
          label: 'Integraciones & API Keys',
          icon: 'pi pi-link',
          routerLink: ['/settings/integrations'],
        },
      ],
    },
  ]);
}
