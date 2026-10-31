import { apiFetch } from '../../../core/api/client';
import { getDatabase } from '../../../core/db/database';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { parseCatalog } from '../domain/catalog';
import { applyCatalog } from './catalogRepository';

let inFlight: Promise<void> | null = null;

/**
 * Descarga el catálogo, lo valida y lo guarda (SPEC-004 RF-1..RF-8). Una sola descarga a la vez:
 * el arranque y el botón de Inventario comparten la promesa. Lanza el error para que el botón lo muestre.
 */
export function syncCatalog(): Promise<void> {
  inFlight ??= download().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// shortcut: solo al arrancar y a mano; descargar al recuperar red llega con el monitor de SPEC-006.
async function download(): Promise<void> {
  const products = parseCatalog(await apiFetch<unknown>('/catalogo'));
  const syncedAt = new Date().toISOString();
  const started = Date.now();
  await applyCatalog(await getDatabase(), products, syncedAt);
  if (__DEV__) console.log(`Catálogo: ${products.length} productos guardados en ${Date.now() - started} ms`);
  useSessionStore.getState().setCatalogSyncedAt(syncedAt);
}
