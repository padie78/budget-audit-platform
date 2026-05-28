/* =============================================================================
 * Supplier Intelligence — utilidades compartidas para los use cases.
 *
 * Aplicar patch sobre un supplier existente preservando todo el snapshot,
 * incrementando `versionId` y actualizando `updatedAt`.
 * ============================================================================= */

import {
  Supplier,
  type SupplierProps,
} from '@budget-audit/domain';

/** Patch parcial sobre un supplier existente. */
export type SupplierIntelligencePatch = Partial<
  Pick<
    SupplierProps,
    | 'strategicIntelligence'
    | 'vendorPerformance'
    | 'smartThresholds'
    | 'complianceAndRisk'
  >
>;

/**
 * Reconstruye un `Supplier` aplicando un patch parcial, incrementando
 * `versionId` y refrescando `updatedAt`.
 */
export function applySupplierPatch(
  current: Supplier,
  patch: SupplierIntelligencePatch,
  now: Date = new Date(),
): Supplier {
  const snap = current.toJSON();
  return Supplier.create({
    ...snap,
    ...patch,
    versionId: (snap.versionId ?? 1) + 1,
    updatedAt: now,
  });
}
