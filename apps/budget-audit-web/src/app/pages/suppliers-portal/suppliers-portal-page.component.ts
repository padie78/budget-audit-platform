import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type FormGroup,
} from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipsModule } from 'primeng/chips';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SliderModule } from 'primeng/slider';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';

import type {
  CreateSupplierInputDto,
  UpdateSupplierInputDto,
} from '@budget-audit/common';

type CreateSupplierViewInput = Omit<CreateSupplierInputDto, 'tenantId'>;
type UpdateSupplierViewInput = Omit<UpdateSupplierInputDto, 'tenantId'>;

/** Recorta un número al rango [0, 1] — usado para enviar ratios al backend. */
function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
import { SupplierService } from '../../services/supplier.service';
import {
  toSupplierRowVm,
  type SupplierRowVm,
} from '../../core/models/supplier-view.models';

/* =============================================================================
 * SuppliersPortalPageComponent — Portal de Proveedores (ABM).
 *
 * Concentra:
 *  - Tabla con búsqueda, sort, paginado (PrimeNG p-table).
 *  - Diálogo crear/editar con form reactivo (validación de email/CUIT).
 *  - Confirmación de borrado.
 *  - Feedback con Toasts.
 *
 * Estado en signals; las operaciones se centralizan en SupplierService que es
 * el único punto que habla GraphQL con AppSync.
 * ============================================================================= */
@Component({
  selector: 'app-suppliers-portal-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConfirmationService, MessageService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    ChipsModule,
    ConfirmDialogModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    ProgressSpinnerModule,
    SliderModule,
    TableModule,
    TagModule,
    ToastModule,
    ToolbarModule,
    TooltipModule,
  ],
  templateUrl: './suppliers-portal-page.component.html',
  styleUrl: './suppliers-portal-page.component.scss',
})
export class SuppliersPortalPageComponent {
  private readonly suppliers = inject(SupplierService);
  private readonly confirm = inject(ConfirmationService);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rows = signal<SupplierRowVm[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly saving = signal<boolean>(false);
  protected readonly dialogVisible = signal<boolean>(false);
  protected readonly editingId = signal<string | null>(null);

  protected readonly stats = computed(() => {
    const list = this.rows();
    const total = list.length;
    const strategic = list.filter((r) => r.criticality === 'STRATEGIC').length;
    const highRisk = list.filter(
      (r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL',
    ).length;
    const avgTolerance =
      total === 0
        ? 0
        : Number(
            (list.reduce((s, r) => s + r.tolerancePercent, 0) / total).toFixed(
              2,
            ),
          );
    return { total, strategic, highRisk, avgTolerance };
  });

  protected readonly currencyOptions = [
    { label: 'USD', value: 'USD' },
    { label: 'EUR', value: 'EUR' },
    { label: 'ARS', value: 'ARS' },
    { label: 'BRL', value: 'BRL' },
  ];

  protected readonly criticalityOptions = [
    { label: 'Bajo', value: 'LOW' },
    { label: 'Medio', value: 'MEDIUM' },
    { label: 'Alto', value: 'HIGH' },
    { label: 'Estratégico', value: 'STRATEGIC' },
  ];

  protected readonly entityOptions = [
    { label: 'Global', value: 'GLOBAL' },
    { label: 'Be\'er Sheva', value: 'BEER_SHEVA' },
    { label: 'Buenos Aires', value: 'BUENOS_AIRES' },
    { label: 'Tel Aviv', value: 'TEL_AVIV' },
    { label: 'Madrid', value: 'MADRID' },
  ];

  protected readonly statusOptions = [
    { label: 'Activo', value: 'ACTIVE' },
    { label: 'Suspendido', value: 'SUSPENDED' },
    { label: 'Bloqueado', value: 'BLOCKED' },
    { label: 'Inactivo', value: 'INACTIVE' },
  ];

  protected readonly sectorOptions = [
    { label: 'Raw materials', value: 'RAW_MATERIALS' },
    { label: 'Logistics', value: 'LOGISTICS' },
    { label: 'Maintenance', value: 'MAINTENANCE' },
    { label: 'IT services', value: 'IT_SERVICES' },
    { label: 'Marketing', value: 'MARKETING' },
    { label: 'Energy', value: 'ENERGY' },
    { label: 'General', value: 'GENERAL' },
  ];

  protected readonly form: FormGroup = this.fb.group({
    entityId: ['GLOBAL', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    taxId: ['', [Validators.required, Validators.minLength(8)]],
    contactEmail: ['', [Validators.required, Validators.email]],
    phone: [''],
    address: [''],
    fidelityScore: [80, [Validators.required, Validators.min(0), Validators.max(100)]],
    percentTolerance: [3, [Validators.required, Validators.min(0)]],
    currency: ['USD', [Validators.required]],
    autoApprovalUpTo: [null],
    criticality: ['MEDIUM'],

    // ─────────── Compliance & ESG ───────────
    status: ['ACTIVE', [Validators.required]],
    primarySectorCode: ['GENERAL', [Validators.required]],
    esgComplianceScore: [
      75,
      [Validators.required, Validators.min(0), Validators.max(100)],
    ],
    certifications: [[] as string[]],
  });

  constructor() {
    this.fetchSuppliers();
  }

  protected fetchSuppliers(): void {
    this.loading.set(true);
    this.suppliers
      .listSuppliers(200)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.rows.set(list.map(toSupplierRowVm));
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'No se pudo cargar el listado',
            detail: this.errorMessage(err),
            life: 5000,
          });
        },
      });
  }

  protected openCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      entityId: 'GLOBAL',
      name: '',
      taxId: '',
      contactEmail: '',
      phone: '',
      address: '',
      fidelityScore: 80,
      percentTolerance: 3,
      currency: 'USD',
      autoApprovalUpTo: null,
      criticality: 'MEDIUM',
      status: 'ACTIVE',
      primarySectorCode: 'GENERAL',
      esgComplianceScore: 75,
      certifications: [] as string[],
    });
    this.dialogVisible.set(true);
  }

  protected openEdit(row: SupplierRowVm): void {
    this.editingId.set(row.id);
    this.loading.set(true);
    this.suppliers
      .getSupplier(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.loading.set(false);
          if (!s) {
            this.toast.add({
              severity: 'warn',
              summary: 'No encontrado',
              detail: 'El proveedor ya no existe.',
            });
            this.fetchSuppliers();
            return;
          }
          this.form.reset({
            entityId: s.entityId ?? 'GLOBAL',
            name: s.name,
            taxId: s.taxId,
            contactEmail: s.contactEmail,
            phone: s.contactInfo?.phone ?? '',
            address: s.contactInfo?.address ?? '',
            fidelityScore: s.fidelityScore,
            percentTolerance: s.thresholdPolicy.percentTolerance,
            currency: s.thresholdPolicy.currency,
            autoApprovalUpTo: s.thresholdPolicy.autoApprovalUpTo,
            criticality:
              s.strategicIntelligence?.criticalityIndex ?? 'MEDIUM',
            status: s.complianceAndRisk?.status ?? 'ACTIVE',
            primarySectorCode:
              s.complianceAndRisk?.primarySectorCode ?? 'GENERAL',
            esgComplianceScore: s.complianceAndRisk?.esgComplianceScore ?? 75,
            certifications: s.complianceAndRisk?.certifications
              ? [...s.complianceAndRisk.certifications]
              : [],
          });
          this.dialogVisible.set(true);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'Error al cargar el proveedor',
            detail: this.errorMessage(err),
          });
        },
      });
  }

  protected closeDialog(): void {
    this.dialogVisible.set(false);
    this.editingId.set(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.add({
        severity: 'warn',
        summary: 'Revisá los campos',
        detail: 'Hay errores de validación en el formulario.',
      });
      return;
    }

    const v = this.form.getRawValue();
    const editingId = this.editingId();

    this.saving.set(true);

    const commonInput = {
      entityId: (v.entityId || 'GLOBAL').trim(),
      name: v.name.trim(),
      taxId: v.taxId.trim(),
      contactEmail: v.contactEmail.trim().toLowerCase(),
      fidelityScore: v.fidelityScore,
      thresholdPolicy: {
        percentTolerance: v.percentTolerance,
        absoluteTolerance: null,
        autoApprovalUpTo: v.autoApprovalUpTo,
        currency: v.currency,
      },
      contactInfo:
        v.phone || v.address
          ? {
              email: v.contactEmail.trim().toLowerCase(),
              phone: v.phone || undefined,
              address: v.address || undefined,
            }
          : undefined,
      strategicIntelligence: {
        riskProfile: {
          score: 80,
          level: 'LOW' as const,
          lastCheck: new Date().toISOString().slice(0, 10),
        },
        paymentStrategy: {
          earlyPaymentPreferred: false,
          discountTargetPercentage: 0,
        },
        diversityStatus: [] as string[],
        criticalityIndex: (v.criticality || 'MEDIUM') as
          | 'LOW'
          | 'MEDIUM'
          | 'HIGH'
          | 'STRATEGIC',
      },
      vendorPerformance: {
        reliabilityScore: clamp01((v.fidelityScore ?? 80) / 100),
        totalAuditedDocs: 0,
        totalDisputesRaised: 0,
        averageDisputeResolutionDays: 0,
        slaDeliveryComplianceRate: 1,
        trend: 'STABLE' as const,
        onboardingStatus: 'PENDING_FIRST_INVOICE' as const,
      },
      complianceAndRisk: {
        status: (v.status || 'ACTIVE') as
          | 'ACTIVE'
          | 'SUSPENDED'
          | 'BLOCKED'
          | 'INACTIVE',
        lastAuditDate: new Date().toISOString(),
        certifications: Array.isArray(v.certifications)
          ? (v.certifications as string[])
              .map((c) => String(c).trim())
              .filter(Boolean)
          : [],
        esgComplianceScore: Math.max(
          0,
          Math.min(100, Number(v.esgComplianceScore ?? 0)),
        ),
        primarySectorCode: (v.primarySectorCode || 'GENERAL').trim(),
      },
    };

    const op$ = editingId
      ? this.suppliers.updateSupplier({
          ...commonInput,
          id: editingId,
        } satisfies UpdateSupplierViewInput)
      : this.suppliers.createSupplier(
          commonInput satisfies CreateSupplierViewInput,
        );

    op$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogVisible.set(false);
          this.editingId.set(null);
          this.toast.add({
            severity: 'success',
            summary: editingId ? 'Proveedor actualizado' : 'Proveedor creado',
            detail: v.name,
          });
          this.fetchSuppliers();
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'No se pudo guardar',
            detail: this.errorMessage(err),
            life: 6000,
          });
        },
      });
  }

  protected confirmDelete(row: SupplierRowVm): void {
    this.confirm.confirm({
      message: `¿Eliminar el proveedor <strong>${row.name}</strong>? Esta acción es irreversible.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.doDelete(row),
    });
  }

  private doDelete(row: SupplierRowVm): void {
    this.suppliers
      .deleteSupplier(row.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.add({
            severity: 'success',
            summary: 'Proveedor eliminado',
            detail: row.name,
          });
          this.rows.update((list) => list.filter((r) => r.id !== row.id));
        },
        error: (err) => {
          this.toast.add({
            severity: 'error',
            summary: 'No se pudo eliminar',
            detail: this.errorMessage(err),
          });
        },
      });
  }

  protected entityLabel(entityId?: string): string {
    if (!entityId) return 'Global';
    const opt = this.entityOptions.find((o) => o.value === entityId);
    return opt ? opt.label : entityId;
  }

  protected riskLabel(level?: string): string {
    switch (level) {
      case 'LOW':
        return 'Bajo';
      case 'MEDIUM':
        return 'Medio';
      case 'HIGH':
        return 'Alto';
      case 'CRITICAL':
        return 'Crítico';
      default:
        return 'Sin clasificar';
    }
  }

  protected trendLabel(trend?: string): string {
    switch (trend) {
      case 'IMPROVING':
        return 'Mejorando';
      case 'STABLE':
        return 'Estable';
      case 'DEGRADING':
        return 'Cayendo';
      default:
        return 'Sin tendencia';
    }
  }

  protected riskSeverity(level?: string): 'success' | 'warning' | 'danger' | 'info' {
    switch (level) {
      case 'LOW':
        return 'success';
      case 'MEDIUM':
        return 'info';
      case 'HIGH':
        return 'warning';
      case 'CRITICAL':
        return 'danger';
      default:
        return 'info';
    }
  }

  protected trendSeverity(trend?: string): 'success' | 'warning' | 'danger' | 'info' {
    switch (trend) {
      case 'IMPROVING':
        return 'success';
      case 'STABLE':
        return 'info';
      case 'DEGRADING':
        return 'danger';
      default:
        return 'info';
    }
  }

  protected criticalityLabel(c?: string): string {
    switch (c) {
      case 'LOW':
        return 'Bajo';
      case 'MEDIUM':
        return 'Medio';
      case 'HIGH':
        return 'Alto';
      case 'STRATEGIC':
        return 'Estratégico';
      default:
        return 'Sin definir';
    }
  }

  protected statusLabel(s?: string): string {
    switch (s) {
      case 'ACTIVE':
        return 'Activo';
      case 'SUSPENDED':
        return 'Suspendido';
      case 'BLOCKED':
        return 'Bloqueado';
      case 'INACTIVE':
        return 'Inactivo';
      default:
        return 'Sin estado';
    }
  }

  protected statusSeverity(
    s?: string,
  ): 'success' | 'warning' | 'danger' | 'info' {
    switch (s) {
      case 'ACTIVE':
        return 'success';
      case 'SUSPENDED':
        return 'warning';
      case 'BLOCKED':
        return 'danger';
      case 'INACTIVE':
        return 'info';
      default:
        return 'info';
    }
  }

  protected onboardingLabel(s?: string): string {
    switch (s) {
      case 'PENDING_FIRST_INVOICE':
        return 'Esperando primera factura';
      case 'ACTIVE':
        return 'Activo';
      case 'OFFBOARDING':
        return 'En offboarding';
      case 'ARCHIVED':
        return 'Archivado';
      default:
        return 'Sin definir';
    }
  }

  protected onboardingSeverity(
    s?: string,
  ): 'success' | 'warning' | 'danger' | 'info' {
    switch (s) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING_FIRST_INVOICE':
        return 'info';
      case 'OFFBOARDING':
        return 'warning';
      case 'ARCHIVED':
        return 'danger';
      default:
        return 'info';
    }
  }

  protected sectorLabel(code?: string): string {
    if (!code) return 'Sin sector';
    const opt = this.sectorOptions.find((o) => o.value === code);
    return opt ? opt.label : code;
  }

  protected hasError(field: string, error: string): boolean {
    const ctrl = this.form.get(field);
    return !!ctrl && ctrl.touched && ctrl.hasError(error);
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null) {
      // AppSync GraphQL errors viajan dentro de `errors[].message`
      const anyErr = err as { errors?: Array<{ message?: string }>; message?: string };
      if (anyErr.errors?.[0]?.message) return anyErr.errors[0].message ?? '';
      if (anyErr.message) return anyErr.message;
    }
    return 'Error desconocido.';
  }
}
