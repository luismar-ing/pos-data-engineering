import { getRandomBytesAsync, randomUUID } from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { getDatabase } from '../db/database';

export interface DeviceIdentity {
  id: string;
  name: string;
  registeredAt: string | null;
}

// La clave incluye el id: en iOS SecureStore sobrevive a desinstalar, así un secreto viejo no se cruza con un id nuevo.
const secretKey = (deviceId: string) => `device_secret.${deviceId}`;

async function readSettings(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>('select key, value from settings');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Identidad estable del dispositivo (SPEC-003 RF-1). La crea en el primer arranque, sin red. */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const settings = await readSettings();
  if (settings.device_id) {
    return {
      id: settings.device_id,
      name: settings.device_name ?? 'Dispositivo POS',
      registeredAt: settings.registered_at ?? null,
    };
  }

  const id = randomUUID();
  const secret = Array.from(await getRandomBytesAsync(32), (b) => b.toString(16).padStart(2, '0')).join('');
  // Primero el secreto: nunca queda un device_id guardado sin su secreto.
  await SecureStore.setItemAsync(secretKey(id), secret);

  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // "or ignore": si dos llamadas corren a la vez en el primer arranque, gana la primera.
    await txn.runAsync(`insert or ignore into settings (key, value) values ('device_id', ?)`, [id]);
    await txn.runAsync(`insert or ignore into settings (key, value) values ('device_name', ?)`, [
      Device.modelName ?? 'Dispositivo POS',
    ]);
  });
  return getDeviceIdentity();
}

/** Secreto del dispositivo. Nunca se registra en logs (RNF-2). */
export async function getDeviceSecret(deviceId: string): Promise<string> {
  const secret = await SecureStore.getItemAsync(secretKey(deviceId));
  // shortcut: si el almacén seguro se borró, el dispositivo no puede autenticarse; hará falta "restablecer identidad" cuando haya baja de dispositivos.
  if (!secret) throw new Error('Falta el secreto del dispositivo en el almacén seguro');
  return secret;
}

export async function setDeviceName(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('El nombre del dispositivo no puede estar vacío');
  const db = await getDatabase();
  await db.runAsync(`insert or replace into settings (key, value) values ('device_name', ?)`, [trimmed]);
}

export async function markRegistered(at: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`insert or replace into settings (key, value) values ('registered_at', ?)`, [at]);
}
