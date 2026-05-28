/**
 * Email de reclamo redactado por el LLM, listo para ser despachado por el
 * usuario desde el frontend con un solo clic.
 */
export interface DisputeEmail {
  to: string;
  cc: string[];
  subject: string;
  body: string;
  /** Resumen ejecutivo de los puntos críticos para que el LLM no se desvíe. */
  highlightedPoints: string[];
  /** URL del PDF analítico generado como adjunto. */
  attachmentUrl: string | null;
  draftedAt: Date;
}
