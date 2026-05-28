import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BudgetAuditorWorkspaceComponent } from '../../features/budget-auditor-workspace/budget-auditor-workspace.component';

/**
 * PAGE — Workspace de auditoría de presupuestos. Se monta como child route
 * dentro del `ShellLayoutComponent`, por lo que NO incluye sidebar/topbar.
 */
@Component({
  selector: 'app-budget-audit-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BudgetAuditorWorkspaceComponent],
  templateUrl: './budget-audit-page.component.html',
  styleUrl: './budget-audit-page.component.scss',
})
export class BudgetAuditPageComponent {}
