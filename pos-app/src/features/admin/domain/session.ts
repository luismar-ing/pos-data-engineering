// SPEC-013: sesión de administrador y rango del panel. Puro, sin Expo: test/admin.test.mjs lo prueba con node.

/** Lo que devuelve `POST /admin/login` y se guarda en SecureStore (RNF-3). */
export interface AdminSession {
  token: string;
  username: string;
  expires_at: string;
}

/** RF-8: vigente hasta `expires_at` (sin incluirlo). Una fecha ilegible cuenta como vencida. */
export function isSessionValid(session: AdminSession | null, nowMs: number): session is AdminSession {
  if (!session) return false;
  const expiresMs = Date.parse(session.expires_at);
  return Number.isFinite(expiresMs) && nowMs < expiresMs;
}

/** Lee la sesión guardada; cualquier cosa con otra forma es "sin sesión" y lleva al login. */
export function parseAdminSession(raw: string | null): AdminSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { token, username, expires_at } = value as Record<string, unknown>;
    if (typeof token !== 'string' || typeof username !== 'string' || typeof expires_at !== 'string') return null;
    return { token, username, expires_at };
  } catch {
    return null;
  }
}

/** Rango por defecto del panel (RF-10): desde el inicio del día local hasta ahora, en ISO para `GET /admin/sales`. */
export function todayRange(nowMs: number): { from: string; to: string } {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: new Date(nowMs).toISOString() };
}
