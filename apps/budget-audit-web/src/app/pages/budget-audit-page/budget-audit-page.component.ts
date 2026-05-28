import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { BudgetAuditorWorkspaceComponent } from '../../features/budget-auditor-workspace/budget-auditor-workspace.component';
import { SidebarComponent } from '../../ui/organisms/sidebar/sidebar.component';
import { TopbarComponent } from '../../ui/organisms/topbar/topbar.component';

/**
 * PAGE — Layout estructural de la aplicación (Sidebar + Topbar + Content).
 * No tiene lógica de negocio: monta el chrome y renderiza la Feature.
 */
@Component({
  selector: 'app-budget-audit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SidebarComponent, TopbarComponent, BudgetAuditorWorkspaceComponent],
  templateUrl: './budget-audit-page.component.html',
  styleUrl: './budget-audit-page.component.scss',
})
export class BudgetAuditPageComponent {
  protected readonly pendingAuditsCount = signal(7);
  protected readonly legalRisksCount = signal(3);
}
