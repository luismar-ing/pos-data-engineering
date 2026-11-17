// SPEC-005: reglas puras de los préstamos. Sin imports de Expo: test/leases.test.mjs las prueba con node.

/** Renovar cuando quede menos de este porcentaje de la cuota (P4). */
export const RENEW_THRESHOLD = 0.2;
/**
 * Tope sin red (SPEC-014 RF-4, ADR-0008): un préstamo activo vende solo hasta 30 min después de `renew_at`.
 * El servidor devuelve la cuota de un dispositivo dado de baja a `expires_at` + 32 min.
 */
export const OFFLINE_CAP_MINUTES = 30;

/** Límite para los SQL de lo vendible: un préstamo con `renew_at` anterior a esto ya no vende. ISO como `renew_at`. */
export function capFrom(nowMs: number): string {
  return new Date(nowMs - OFFLINE_CAP_MINUTES * 60_000).toISOString();
}

/** Máximo de elementos por petición a /prestamos (contrato de ARCHITECTURE.md). */
export const LEASE_CHUNK = 200;

export interface DueCheck {
  quota_total: number;
  quota_used: number;
  /** Hora local en que conviene renovar (ISO). */
  renew_at: string;
}

/** ¿Toca cerrar este préstamo? Vencido, con poca cuota, o sin sesión abierta (RF-10, RF-13). */
export function isLeaseDue(lease: DueCheck, nowMs: number, sessionOpen: boolean): boolean {
  if (!sessionOpen) return true;
  if (nowMs >= Date.parse(lease.renew_at)) return true;
  return lease.quota_total - lease.quota_used < lease.quota_total * RENEW_THRESHOLD;
}

/**
 * Hora local de renovar: inicio de la petición + duración que dio el servidor.
 * Solo se usa la diferencia de horas del servidor, así un reloj del teléfono desfasado no la mueve. Se cuenta desde
 * que se pidió (no desde que llegó la respuesta) para que el tope sin red caiga antes que el del servidor (ADR-0008).
 */
export function renewAt(issuedAt: string, expiresAt: string, requestedAtMs: number): string {
  return new Date(requestedAtMs + (Date.parse(expiresAt) - Date.parse(issuedAt))).toISOString();
}

export function chunk<T>(items: T[], size = LEASE_CHUNK): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}
