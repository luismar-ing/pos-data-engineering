import { ApiError, apiFetch } from '../api/client';
import { API_URL } from '../config';
import { getDeviceIdentity, getDeviceSecret, markRegistered } from './deviceIdentity';

let inFlight: Promise<boolean> | null = null;

/**
 * Registra el dispositivo en el servidor si aún no lo está (SPEC-003 RF-2). Nunca lanza:
 * sin red o con error devuelve false y se reintenta en la siguiente llamada.
 * `force` vuelve a enviar el registro (p. ej. tras renombrar el dispositivo).
 */
export function ensureRegistered(force = false): Promise<boolean> {
  inFlight ??= register(force).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// shortcut: solo se reintenta al arrancar o al pedirlo desde Ajustes; reintentar al recuperar red llega con el monitor de SPEC-006.
async function register(force: boolean): Promise<boolean> {
  const identity = await getDeviceIdentity();
  if (identity.registeredAt && !force) return true;
  if (!API_URL) return false;

  try {
    await apiFetch('/devices/register', {
      method: 'POST',
      body: { device_id: identity.id, name: identity.name, secret: await getDeviceSecret(identity.id) },
    });
    await markRegistered(new Date().toISOString());
    return true;
  } catch (error) {
    // Solo el código: el cuerpo de la petición lleva el secreto.
    console.warn('Registro del dispositivo pendiente:', error instanceof ApiError ? error.code : 'sin conexión');
    return false;
  }
}
