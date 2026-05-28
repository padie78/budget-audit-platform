export const AlertSeverity = {
  Green: 'GREEN',
  Yellow: 'YELLOW',
  Red: 'RED',
} as const;
export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

/**
 * Política de severidad por desvío porcentual. Centraliza la regla de negocio
 * que distingue alertas verdes (sin sobreprecio), amarillas (dentro de la
 * tolerancia o cuando no hay precio pactado) y rojas (sobreprecio real).
 */
export class SeverityPolicy {
  static fromDeviation(params: {
    deviationPercent: number;
    tolerancePercent: number;
    hasAgreedPrice: boolean;
  }): AlertSeverity {
    if (!params.hasAgreedPrice) return AlertSeverity.Yellow;
    if (params.deviationPercent <= 0) return AlertSeverity.Green;
    if (params.deviationPercent <= params.tolerancePercent)
      return AlertSeverity.Yellow;
    return AlertSeverity.Red;
  }
}
