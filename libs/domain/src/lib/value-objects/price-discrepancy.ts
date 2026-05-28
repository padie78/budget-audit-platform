import { Money } from './money';
import { AlertSeverity, SeverityPolicy } from './alert-severity';
import { ThresholdPolicy } from './threshold-policy';

/**
 * Resultado matemático del análisis de un ítem cotizado contra el contrato
 * línea base. Encapsula desvío monetario, desvío porcentual e impacto
 * proyectado (cantidad × diferencia).
 */
export interface PriceDiscrepancyInput {
  sku: string;
  description: string;
  quantity: number;
  quotedUnitPrice: Money;
  agreedUnitPrice: Money | null;
  policy: ThresholdPolicy;
}

export class PriceDiscrepancy {
  readonly sku: string;
  readonly description: string;
  readonly quantity: number;
  readonly quotedUnitPrice: Money;
  readonly agreedUnitPrice: Money | null;
  readonly deviationPercent: number;
  readonly deviationPerUnit: Money;
  readonly projectedImpact: Money;
  readonly severity: AlertSeverity;
  readonly message: string;

  private constructor(props: {
    sku: string;
    description: string;
    quantity: number;
    quotedUnitPrice: Money;
    agreedUnitPrice: Money | null;
    deviationPercent: number;
    deviationPerUnit: Money;
    projectedImpact: Money;
    severity: AlertSeverity;
    message: string;
  }) {
    this.sku = props.sku;
    this.description = props.description;
    this.quantity = props.quantity;
    this.quotedUnitPrice = props.quotedUnitPrice;
    this.agreedUnitPrice = props.agreedUnitPrice;
    this.deviationPercent = props.deviationPercent;
    this.deviationPerUnit = props.deviationPerUnit;
    this.projectedImpact = props.projectedImpact;
    this.severity = props.severity;
    this.message = props.message;
  }

  static compute(input: PriceDiscrepancyInput): PriceDiscrepancy {
    const currency = input.quotedUnitPrice.currency;
    const agreed = input.agreedUnitPrice;
    const deviationPercent = agreed
      ? input.quotedUnitPrice.deviationPercentAgainst(agreed)
      : 0;

    const deviationPerUnit = agreed
      ? input.quotedUnitPrice.subtract(agreed)
      : Money.zero(currency);

    const projectedImpact = agreed && input.quotedUnitPrice.greaterThan(agreed)
      ? deviationPerUnit.multiply(input.quantity)
      : Money.zero(currency);

    const withinPolicy = agreed
      ? input.policy.isWithinTolerance(deviationPercent, projectedImpact)
      : false;

    const severity = SeverityPolicy.fromDeviation({
      deviationPercent,
      tolerancePercent: withinPolicy ? deviationPercent : input.policy.percent,
      hasAgreedPrice: !!agreed,
    });

    return new PriceDiscrepancy({
      sku: input.sku,
      description: input.description,
      quantity: input.quantity,
      quotedUnitPrice: input.quotedUnitPrice,
      agreedUnitPrice: agreed,
      deviationPercent,
      deviationPerUnit,
      projectedImpact,
      severity,
      message: PriceDiscrepancy.buildMessage(
        severity,
        deviationPercent,
        !!agreed,
        projectedImpact.amount,
      ),
    });
  }

  private static buildMessage(
    severity: AlertSeverity,
    deviationPercent: number,
    hasAgreedPrice: boolean,
    impactAmount: number,
  ): string {
    if (!hasAgreedPrice) {
      return 'Ítem fuera del contrato línea base; requiere revisión manual.';
    }
    switch (severity) {
      case AlertSeverity.Green:
        return 'Precio cotizado dentro o por debajo del valor pactado.';
      case AlertSeverity.Yellow:
        return `Desvío del ${deviationPercent.toFixed(2)}% pre-aprobado dentro de la tolerancia.`;
      case AlertSeverity.Red:
        return `Sobreprecio del ${deviationPercent.toFixed(2)}% — impacto proyectado ${impactAmount.toFixed(2)}.`;
    }
  }
}
