import { randomUUID } from 'expo-crypto';
import { useSessionStore } from '../../shared/store/sessionStore';
import { ApiError, apiFetch } from '../api/client';
import { API_URL } from '../config';
import { getDeviceIdentity, getDeviceSecret } from '../device/deviceIdentity';
import { ensureRegistered } from '../device/registration';
import { fitBatch, toWireEvent } from './syncBatch';
import { applyResults, getPendingBatch, type EventResult } from './syncRepository';

let running = false;
let again = false;

/**
 * Batch ETL (SPEC-008): envía los eventos pendientes en lotes hasta vaciar la cola. Nunca lanza.
 * Una ejecución a la vez; si lo llaman mientras corre, vuelve a correr al terminar (RF-5).
 */
export async function syncEvents(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await runOnce().catch((error: unknown) =>
        // RF-14: los eventos siguen pending y se reintentan en el siguiente disparo.
        console.warn('Sync pendiente:', error instanceof ApiError ? error.code : String(error))
      );
    } while (again);
  } finally {
    running = false;
  }
}

async function runOnce(): Promise<void> {
  if (!API_URL || !useSessionStore.getState().isOnline) return;
  let rows = await getPendingBatch();
  if (rows.length === 0) return; // sin pendientes no hay petición (P2)
  if (!(await ensureRegistered())) return;
  const { id: deviceId } = await getDeviceIdentity();
  const secret = await getDeviceSecret(deviceId);

  while (rows.length > 0) {
    const events = fitBatch(rows.map((row) => toWireEvent(row, deviceId)));
    const { results } = await apiFetch<{ results: EventResult[] }>('/sync/events', {
      method: 'POST',
      secret,
      body: { batch_id: randomUUID(), sent_at: new Date().toISOString(), events },
    });
    const now = new Date().toISOString();
    const changed = await applyResults(results, now);
    useSessionStore.getState().setEventsSyncedAt(now);
    if (changed === 0) return; // la respuesta no marcó nada: no repetir el mismo lote en bucle
    rows = await getPendingBatch();
  }
}
