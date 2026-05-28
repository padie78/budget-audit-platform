/* =============================================================================
 * @budget-audit/domain — Barrel del bounded context.
 *
 * Capas (orden de dependencias hacia abajo):
 *   • errors            (sin deps)
 *   • value-objects     (deps: errors)
 *   • entities          (deps: VOs)
 *   • ports             (deps: entities + VOs)
 * ============================================================================= */

// Errors
export * from './lib/errors/domain-errors';

// Value Objects — primitivos / core
export * from './lib/value-objects/money';
export * from './lib/value-objects/alert-severity';
export * from './lib/value-objects/threshold-policy';

// Value Objects — análisis financiero
export * from './lib/value-objects/price-discrepancy';
export * from './lib/value-objects/three-way-match';
export * from './lib/value-objects/cash-flow-projection';

// Value Objects — legal & disputas
export * from './lib/value-objects/legal-clause-risk';
export * from './lib/value-objects/dispute-email';
export * from './lib/value-objects/dispute-workflow';

// Value Objects — Supplier enterprise
export * from './lib/value-objects/strategic-intelligence';
export * from './lib/value-objects/vendor-performance';
export * from './lib/value-objects/smart-thresholds';
export * from './lib/value-objects/compliance-and-risk';

// Value Objects — Contract enterprise
export * from './lib/value-objects/financial-limits';
export * from './lib/value-objects/legal-baseline';
export * from './lib/value-objects/predictive-engine';
export * from './lib/value-objects/sustainability-esg';

// Value Objects — Audit enterprise (consolidado)
export * from './lib/value-objects/ai-analysis';
export * from './lib/value-objects/audit-analytics';

// Entities (aggregate roots)
export * from './lib/entities/supplier';
export * from './lib/entities/contract';
export * from './lib/entities/budget';

// Ports
export * from './lib/ports/budget-repository.port';
export * from './lib/ports/contract-repository.port';
export * from './lib/ports/supplier-repository.port';
export * from './lib/ports/ai-extractor-service.port';
export * from './lib/ports/audit-event-publisher.port';
export * from './lib/ports/dispute-writer-service.port';
