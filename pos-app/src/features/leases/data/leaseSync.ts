import { ApiError, apiFetch } from '../../../core/api/client';
import { API_URL } from '../../../core/config';
import { getDeviceIdentity, getDeviceSecret } from '../../../core/device/deviceIdentity';
import { ensureRegistered } from '../../../core/device/registration';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { chunk } from '../domain/leasePolicy';
import {
  getClosing,
  markDueAsClosing,
  markReleased,
  productsWithoutLease,
  saveLeases,
  type ServerLease,
} from './leaseRepository';

let running = false;
let again = false;

/**
 * Ciclo de préstamos (SPEC-005 plan §1): cierra lo que toca y pide lo que falta. Nunca lanza.
 * Una ejecución a la vez; si lo llaman mientras corre (p. ej. al cerrar la sesión), vuelve a correr al terminar.
 */
export async function leaseSync(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await runOnce().catch((error: unknown) =>
        console.warn('Préstamos pendientes:', error instanceof ApiError ? error.code : String(error))
      );
    } while (again);
  } finally {
    running = false;
  }
}

async function runOnce(): Promise<void> {
  if (!API_URL || !useSessionStore.getState().isOnline) return;
  if (!(await ensureRegistered())) return;
  const { id } = await getDeviceIdentity();
  const secret = await getDeviceSecret(id);
  let changed = false;

  try {
    const { sessionOpen, marked } = await markDueAsClosing(Date.now());
    changed = marked > 0;

    // Todos los `closing`, también los de un intento fallido, con el mismo quota_reported (RF-12).
    for (const part of chunk(await getClosing())) {
      await apiFetch('/prestamos/close', {
        method: 'POST',
        secret,
        body: { leases: part.map((lease) => ({ lease_id: lease.id, quota_used: lease.quota_reported })) },
      });
      await markReleased(part.map((lease) => lease.id));
      changed = true;
    }

    if (!sessionOpen) return; // RF-13: al cerrar la sesión solo se libera
    // shortcut: pide cada ciclo los productos sin stock aunque sigan sin stock; con catálogos grandes, espaciar esos reintentos.
    for (const part of chunk(await productsWithoutLease())) {
      const { leases } = await apiFetch<{ leases: ServerLease[] }>('/prestamos/request', {
        method: 'POST',
        secret,
        body: { product_ids: part },
      });
      await saveLeases(leases, Date.now());
      if (leases.length) changed = true;
    }
  } finally {
    if (changed) useSessionStore.getState().setLeasesUpdatedAt(new Date().toISOString());
  }
}
