import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase } from '../../../core/db/database';
import { getDeviceIdentity } from '../../../core/device/deviceIdentity';

/** Sesión de trabajo de un vendedor en este dispositivo (SPEC-003). */
export interface Session {
  id: string;
  device_id: string;
  seller_name: string;
  opened_at: string;
  closed_at: string | null;
}

export class SessionAlreadyOpenError extends Error {
  constructor() {
    super('Ya hay una sesión abierta en este dispositivo; ciérrala antes de abrir otra');
  }
}

type SessionRow = Omit<Session, 'device_id'>;

export async function getOpenSession(): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SessionRow>(
    'select id, seller_name, opened_at, closed_at from sessions where closed_at is null'
  );
  if (!row) return null;
  const { id: device_id } = await getDeviceIdentity();
  return { ...row, device_id };
}

/** Abre una sesión y registra `session_opened` en la bitácora, en una transacción. Funciona sin red. */
export async function openSession(sellerName: string): Promise<Session> {
  const seller_name = sellerName.trim();
  if (!seller_name) throw new Error('Escribe el nombre del vendedor');

  const { id: device_id } = await getDeviceIdentity();
  const session: Session = { id: randomUUID(), device_id, seller_name, opened_at: new Date().toISOString(), closed_at: null };

  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // El índice único también lo impide; esto da un error claro.
    if (await txn.getFirstAsync('select id from sessions where closed_at is null')) throw new SessionAlreadyOpenError();
    await txn.runAsync('insert into sessions (id, seller_name, opened_at) values (?, ?, ?)', [
      session.id,
      session.seller_name,
      session.opened_at,
    ]);
    await insertSessionEvent(txn, 'session_opened', session);
  });
  return session;
}

/** Cierra la sesión abierta y registra `session_closed`. Devuelve null si no había ninguna. */
export async function closeSession(): Promise<Session | null> {
  const open = await getOpenSession();
  if (!open) return null;
  const closed: Session = { ...open, closed_at: new Date().toISOString() };

  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('update sessions set closed_at = ? where id = ? and closed_at is null', [closed.closed_at, closed.id]);
    await insertSessionEvent(txn, 'session_closed', closed);
  });
  return closed;
}

async function insertSessionEvent(txn: SQLiteDatabase, type: 'session_opened' | 'session_closed', session: Session) {
  const createdAt = type === 'session_opened' ? session.opened_at : (session.closed_at as string);
  await txn.runAsync(
    `insert into event_log (id, event_type, entity_type, entity_id, payload_json, created_at)
     values (?, ?, 'session', ?, ?, ?)`,
    [randomUUID(), type, session.id, JSON.stringify({ session }), createdAt]
  );
}
