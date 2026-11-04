// SPEC-008: SQL de la bitácora para el sync. Sin imports: test/sync.test.mjs lo prueba con node:sqlite.
// Solo se tocan los datos de sincronización (sync_status, synced_at, sync_error), nunca el evento (principio 3).

/** Extract: pendientes en orden de creación. */
export const PENDING_BATCH_SQL = `
  select id, event_type, payload_json, created_at from event_log
  where sync_status = 'pending'
  order by created_at, id
  limit ?`;

export const MARK_SYNCED_SQL = `update event_log set sync_status = 'synced', synced_at = ? where id = ? and sync_status = 'pending'`;

export const MARK_FAILED_SQL = `update event_log set sync_status = 'failed', sync_error = ? where id = ? and sync_status = 'pending'`;

export const SYNC_COUNTS_SQL = `select sync_status, count(*) as n from event_log group by sync_status`;

export const SET_EVENTS_SYNCED_AT_SQL = `insert or replace into settings (key, value) values ('events_synced_at', ?)`;
export const GET_EVENTS_SYNCED_AT_SQL = `select value from settings where key = 'events_synced_at'`;
