// SPEC-008: transformación de la bitácora al formato de POST /sync/events. Puro: lo prueba test/sync.test.mjs.

/** Máximo de eventos por lote (P3) y peso máximo del lote; el servidor acepta hasta 100 kB. */
export const BATCH_SIZE = 50;
export const MAX_BATCH_BYTES = 80_000;

export interface EventRow {
  id: string;
  event_type: string;
  payload_json: string;
  created_at: string;
}

export interface WireEvent {
  event_id: string;
  event_type: string;
  device_id: string;
  created_at: string;
  payload: unknown;
}

/** Evento tal como se guardó: el payload viaja sin cambios. */
export function toWireEvent(row: EventRow, deviceId: string): WireEvent {
  return {
    event_id: row.id,
    event_type: row.event_type,
    device_id: deviceId,
    created_at: row.created_at,
    payload: JSON.parse(row.payload_json),
  };
}

/** Recorta el lote para no pasar de `maxBytes`; siempre deja al menos un evento (RNF-4). */
export function fitBatch(events: WireEvent[], maxBytes = MAX_BATCH_BYTES): WireEvent[] {
  let bytes = 0;
  let count = 0;
  for (const event of events) {
    bytes += JSON.stringify(event).length + 1;
    if (count > 0 && bytes > maxBytes) break;
    count++;
  }
  return events.slice(0, count);
}
