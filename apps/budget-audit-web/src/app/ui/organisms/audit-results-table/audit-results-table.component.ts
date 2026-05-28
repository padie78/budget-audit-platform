import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SeverityBadgeComponent } from '../../atoms/severity-badge/severity-badge.component';
import type { AuditResultRow } from '../../../core/models/audit-view.models';

type SeverityFilter = 'ALL' | 'RED' | 'YELLOW' | 'GREEN';

/**
 * ORGANISM — Tabla compleja de resultados de auditoría. Reutiliza el átomo
 * `app-severity-badge` para representar cada severidad. Es agnóstica al
 * backend: solo recibe un array de filas planas y emite ningún evento al
 * exterior; expone un filtro interno por severidad como UX nicety.
 */
@Component({
  selector: 'app-audit-results-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SeverityBadgeComponent],
  templateUrl: './audit-results-table.component.html',
  styleUrl: './audit-results-table.component.scss',
})
export class AuditResultsTableComponent {
  readonly rows = input.required<readonly AuditResultRow[]>();
  readonly currency = input<string>('USD');
  readonly emptyMessage = input<string>('Aún no hay ítems auditados.');

  protected readonly filter = input<SeverityFilter>('ALL');
  protected readonly internalFilter = computed<SeverityFilter>(() => this.filter());

  protected readonly visibleRows = computed<readonly AuditResultRow[]>(() => {
    const f = this.internalFilter();
    if (f === 'ALL') return this.rows();
    return this.rows().filter((r) => r.severity === f);
  });

  protected readonly counts = computed(() => {
    const list = this.rows();
    return {
      total: list.length,
      red: list.filter((r) => r.severity === 'RED').length,
      yellow: list.filter((r) => r.severity === 'YELLOW').length,
      green: list.filter((r) => r.severity === 'GREEN').length,
    };
  });

  protected trackBySku(_index: number, row: AuditResultRow): string {
    return row.sku;
  }

  protected formatPercent(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
}
