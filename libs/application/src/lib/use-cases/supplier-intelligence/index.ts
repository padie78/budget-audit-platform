/* =============================================================================
 * Supplier Intelligence — use cases del bounded context.
 *
 * Cada use case sigue el patrón de Clean Architecture:
 *   • Depende sólo de ports del domain.
 *   • La lógica de fórmula vive en `domain/services/supplier-intelligence`.
 *   • El use case orquesta: lee histórico via port, llama calculadora, persiste.
 * ============================================================================= */

export * from './supplier-patch';
export * from './recalc-vendor-performance.use-case';
export * from './recalc-risk-profile.use-case';
export * from './recalc-payment-strategy.use-case';
export * from './suggest-category-thresholds.use-case';
export * from './recalc-esg-score.use-case';
export * from './extract-certifications.use-case';
export * from './classify-diversity.use-case';
export * from './recalc-supplier-intelligence.use-case';
