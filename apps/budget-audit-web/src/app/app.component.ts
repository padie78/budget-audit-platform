import { Component } from '@angular/core';
import { BudgetAuditPageComponent } from './pages/budget-audit-page/budget-audit-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BudgetAuditPageComponent],
  template: `<app-budget-audit-page></app-budget-audit-page>`,
})
export class AppComponent {}
