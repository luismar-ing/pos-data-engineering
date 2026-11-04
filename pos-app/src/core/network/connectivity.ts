// SPEC-006: lógica del estado de conexión, sin Expo ni React Native para probarla con node:test.

export const PROBE_INTERVAL_MS = 15_000; // P2
export const PROBE_TIMEOUT_MS = 3_000; // P2, RNF-3
export const CATALOG_STALE_MS = 5 * 60_000; // P4

type FetchFn = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number }>;

/** En línea solo si `GET /health` responde 200 (P1, P5). Nunca lanza. */
export async function probeServer(
  apiUrl: string | undefined,
  fetchFn: FetchFn,
  timeoutMs = PROBE_TIMEOUT_MS
): Promise<boolean> {
  if (!apiUrl) return false; // RF-5
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${apiUrl}/health`, { signal: controller.signal });
    return res.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

interface ConnectivityDeps {
  probe: () => Promise<boolean>;
  setOnline: (online: boolean) => void;
  timers: { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void };
}

export function createConnectivity({ probe, setOnline, timers }: ConnectivityDeps) {
  let inFlight: Promise<void> | null = null;
  let interval: unknown = null;
  const listeners = new Set<() => void>();

  /** Comprueba el servidor; una sola comprobación a la vez. */
  function check(): Promise<void> {
    inFlight ??= probe()
      .catch(() => false)
      .then(setOnline)
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  /** Llamar en cada cambio de `isOnline`: reintenta sin conexión (RF-3) y avisa al volver (RF-7). */
  function handleChange(prev: boolean, next: boolean): void {
    if (prev === next) return;
    if (!next) {
      interval ??= timers.set(() => void check(), PROBE_INTERVAL_MS);
      return;
    }
    if (interval !== null) {
      timers.clear(interval);
      interval = null;
    }
    listeners.forEach((fn) => fn());
  }

  /** Suscribe una acción a cada reconexión; devuelve la función para quitarla. */
  function onReconnect(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { check, handleChange, onReconnect };
}

/** El catálogo se vuelve a descargar al reconectar si la última descarga tiene más de 5 min (P4). */
export function isCatalogStale(syncedAt: string | null, now: number): boolean {
  if (!syncedAt) return true;
  return !(now - Date.parse(syncedAt) <= CATALOG_STALE_MS); // fecha inválida ⇒ vencido
}
