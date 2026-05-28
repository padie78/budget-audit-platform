/**
 * Value Object para representar montos monetarios sin perder precisión.
 * Internamente trabaja con enteros (cents) y expone helpers de redondeo.
 */
export class Money {
  private constructor(
    private readonly cents: number,
    public readonly currency: string,
  ) {}

  static from(amount: number, currency: string): Money {
    if (!Number.isFinite(amount)) {
      throw new Error(`Monto inválido: ${amount}`);
    }
    return new Money(Math.round(amount * 100), currency.toUpperCase());
  }

  static zero(currency: string): Money {
    return new Money(0, currency.toUpperCase());
  }

  get amount(): number {
    return this.cents / 100;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.cents - other.cents, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(Math.round(this.cents * factor), this.currency);
  }

  /** Desvío porcentual ((quoted - agreed) / agreed) * 100. */
  deviationPercentAgainst(baseline: Money): number {
    this.assertSameCurrency(baseline);
    if (baseline.cents === 0) return 0;
    return ((this.cents - baseline.cents) / baseline.cents) * 100;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents > other.cents;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Operación entre monedas distintas: ${this.currency} vs ${other.currency}`,
      );
    }
  }
}
