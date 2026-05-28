import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BudgetAuditorWorkspaceComponent } from '../../features/budget-auditor-workspace/budget-auditor-workspace.component';

/**
 * PAGE — Layout estructural de la aplicación (Sidebar + Topbar + Content).
 * No tiene lógica de negocio: monta el chrome y renderiza la Feature.
 */
@Component({
  selector: 'app-budget-audit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BudgetAuditorWorkspaceComponent],
  templateUrl: './budget-audit-page.component.html',
  styleUrl: './budget-audit-page.component.scss',
})
export class BudgetAuditPageComponent {
  protected readonly navItems = [
    { id: 'audit', label: 'Auditorías', icon: '◎', active: true },
    { id: 'suppliers', label: 'Proveedores', icon: '☷', active: false },
    { id: 'contracts', label: 'Contratos', icon: '⎈', active: false },
    { id: 'reports', label: 'Reportes', icon: '↗', active: false },
  ];
}
