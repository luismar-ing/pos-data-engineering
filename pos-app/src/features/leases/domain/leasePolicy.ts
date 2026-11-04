// SPEC-005: reglas puras de los préstamos. Sin imports de Expo: test/leases.test.mjs las prueba con node.

/** Renovar cuando quede menos de este porcentaje de la cuota (P4). */
export const RENEW_THRESHOLD = 0.2;
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
 * Hora local de renovar: recibido + duración que dio el servidor.
 * Solo se usa la diferencia de horas del servidor, así un reloj del teléfono desfasado no la mueve.
 */
export function renewAt(issuedAt: string, expiresAt: string, receivedAtMs: number): string {
  return new Date(receivedAtMs + (Date.parse(expiresAt) - Date.parse(issuedAt))).toISOString();
}

export function chunk<T>(items: T[], size = LEASE_CHUNK): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}
