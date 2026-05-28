import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import type { BudgetDto } from '@budget-audit/common';
import { BudgetService } from '../../services/budget.service';
import { BudgetUploadService } from '../../services/budget-upload.service';
import {
  buildAuditSummary,
  mapAlertToRow,
  type AuditResultRow,
  type AuditSummaryVm,
  type AuditWorkspaceState,
} from '../../core/models/audit-view.models';
import { FileDropzoneComponent } from '../../ui/molecules/file-dropzone/file-dropzone.component';
import { AuditResultsTableComponent } from '../../ui/organisms/audit-results-table/audit-results-table.component';

/**
 * FEATURE — Componente inteligente que conoce el negocio.
 *
 * Responsabilidades:
 *   - Orquesta la molécula de upload y el organismo de resultados.
 *   - Habla con el `BudgetService` para disparar mutations y subscribirse.
 *   - Mantiene el estado de la auditoría como signals (idle / uploading /
 *     processing / completed / failed).
 *   - Mapea los DTOs del backend a `AuditResultRow` para que la tabla siga
 *     siendo pura.
 *
 * Aplica un patrón de "race-friendly": si la subscription en tiempo real
 * llega antes que la respuesta de la mutation, se acepta la primera y la
 * otra simplemente refresca sin causar parpadeo.
 */
@Component({
  selector: 'app-budget-auditor-workspace',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    FileDropzoneComponent,
    AuditResultsTableComponent,
  ],
  templateUrl: './budget-auditor-workspace.component.html',
  styleUrl: './budget-auditor-workspace.component.scss',
})
export class BudgetAuditorWorkspaceComponent {
  private readonly budgetService = inject(BudgetService);
  private readonly uploader = inject(BudgetUploadService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly supplierId = signal<string>('');
  protected readonly file = signal<File | null>(null);
  protected readonly state = signal<AuditWorkspaceState>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly budget = signal<BudgetDto | null>(null);

  protected readonly summary = computed<AuditSummaryVm | null>(() => {
    const b = this.budget();
    return b ? buildAuditSummary(b) : null;
  });

  protected readonly rows = computed<readonly AuditResultRow[]>(() => {
    const b = this.budget();
    return b ? b.alerts.map(mapAlertToRow) : [];
  });

  protected readonly isBusy = computed(
    () => this.state() === 'uploading' || this.state() === 'processing',
  );

  protected readonly canSubmit = computed(
    () => !!this.supplierId().trim() && !!this.file() && !this.isBusy(),
  );

  private liveSubscription?: Subscription;

  protected onFileSelected(file: File): void {
    this.file.set(file);
    this.errorMessage.set(null);
  }

  protected onFileRejected(event: { file: File; reason: string }): void {
    this.errorMessage.set(event.reason);
    this.file.set(null);
  }

  protected startAudit(): void {
    const file = this.file();
    const supplierId = this.supplierId().trim();
    if (!file || !supplierId) return;

    this.errorMessage.set(null);
    this.budget.set(null);
    this.state.set('uploading');

    this.subscribeToCompletion(supplierId);

    this.uploader
      .uploadPdf(supplierId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ s3Url }) => {
          this.state.set('processing');
          this.budgetService
            .auditBudget({ supplierId, s3Url })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (budget) => {
                if (!this.budget()) this.budget.set(budget);
                this.state.set(
                  budget.status === 'FAILED' ? 'failed' : 'completed',
                );
              },
              error: (err) => this.handleError(err),
            });
        },
        error: (err) => this.handleError(err),
      });
  }

  private subscribeToCompletion(supplierId: string): void {
    this.liveSubscription?.unsubscribe();
    this.liveSubscription = this.budgetService
      .onAuditCompleted(supplierId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (budget) => {
          this.budget.set(budget);
          this.state.set(budget.status === 'FAILED' ? 'failed' : 'completed');
        },
        error: (err) =>
          console.error('Error en subscription onAuditCompleted', err),
      });
  }

  private handleError(err: unknown): void {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    this.errorMessage.set(message);
    this.state.set('failed');
  }
}
