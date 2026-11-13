import { getDatabase } from '../../../core/db/database';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { isRole, type Role } from '../domain/role';

/** Último rol elegido (SPEC-013 RF-3), en `settings`; null si nunca se eligió o lo guardado no es válido. */
export async function getRole(): Promise<Role | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`select value from settings where key = 'role'`);
  return isRole(row?.value) ? row.value : null;
}

/** null borra el rol: la próxima vez se muestra la selección (RF-1). */
export async function setRole(role: Role | null): Promise<void> {
  const db = await getDatabase();
  if (role) await db.runAsync(`insert or replace into settings (key, value) values ('role', ?)`, [role]);
  else await db.runAsync(`delete from settings where key = 'role'`);
}

/** Guarda el rol y cambia la navegación (RF-1..RF-3). Quien llama revisa antes `canSwitchRole` (RF-4). */
export async function applyRole(role: Role | null): Promise<void> {
  await setRole(role);
  useSessionStore.getState().setRole(role);
}
