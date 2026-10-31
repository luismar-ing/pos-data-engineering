import { API_URL } from '../config';

/** Error HTTP con el `code` estable del backend (forma de error de SPEC-002). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

interface ApiRequest {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Secreto del dispositivo para las rutas autenticadas (SPEC-003 RF-5). */
  secret?: string;
}

export async function apiFetch<T>(path: string, { method = 'GET', body, secret }: ApiRequest = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'NO_API_URL', 'Falta EXPO_PUBLIC_API_URL en .env.local');

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (secret) headers.authorization = `Bearer ${secret}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? 'HTTP_ERROR', json?.error?.message ?? `HTTP ${res.status}`);
  }
  return json as T;
}
