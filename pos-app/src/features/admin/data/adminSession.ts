import * as SecureStore from 'expo-secure-store';
import { parseAdminSession, type AdminSession } from '../domain/session';

// SPEC-013 RNF-3: el token de administrador va en el almacén seguro, igual que el secreto del dispositivo.
const KEY = 'admin_session';

export async function loadAdminSession(): Promise<AdminSession | null> {
  return parseAdminSession(await SecureStore.getItemAsync(KEY));
}

export async function saveAdminSession(session: AdminSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearAdminSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
