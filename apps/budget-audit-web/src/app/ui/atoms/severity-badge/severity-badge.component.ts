import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { AlertSeverity } from '@budget-audit/common';

/**
 * ATOM — Badge visual puro para representar un nivel de severidad de alerta.
 * No conoce el dominio de presupuestos: simplemente recibe el estado y se
 * pinta. Reutilizable en cualquier vista que necesite mostrar criticidad.
 */
@Component({
  selector: 'app-severity-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [attr.data-severity]="severity()" role="status">
      <span class="badge__dot" aria-hidden="true"></span>
      <span class="badge__label">{{ label() }}</span>
    </span>
  `,
  styleUrl: './severity-badge.component.scss',
})
export class SeverityBadgeComponent {
  readonly severity = input.required<AlertSeverity>();
  readonly customLabel = input<string | null>(null);

  protected readonly label = computed(() => {
    const custom = this.customLabel();
    if (custom) return custom;
    switch (this.severity()) {
      case 'RED':
        return 'CRÍTICO';
      case 'YELLOW':
        return 'REVISAR';
      case 'GREEN':
        return 'OK';
    }
  });
}
