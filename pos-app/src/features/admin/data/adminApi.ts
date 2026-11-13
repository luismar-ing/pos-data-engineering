import { ApiError, apiFetch } from '../../../core/api/client';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { isSessionValid, type AdminSession } from '../domain/session';
import { clearAdminSession, saveAdminSession } from './adminSession';

// SPEC-013: rutas /admin (contratos en ARCHITECTURE.md §5).

interface Money {
  revenue_cents: number;
  sales: number;
}

export interface SalesSummary {
  generated_at: string;
  totals: Money & { average_ticket_cents: number };
  by_device: (Money & { device_id: string; name: string | null; last_seen_at: string | null; last_sync_at: string | null })[];
  by_session: (Money & { session_id: string | null; seller_name: string | null; device_id: string })[];
  by_hour: (Money & { hour: string })[];
  by_payment_method: (Money & { payment_method: string })[];
  top_products: { product_id: string; name: string; units: number; revenue_cents: number }[];
}

export type StockStatus = 'ok' | 'no_cuadra' | 'sync_supera_stock' | 'sin_stock_inicial';

export interface StockProduct {
  product_id: string;
  name: string;
  initial_stock: number | null;
  central_stock: number;
  leased_active: number;
  reported_sold: number;
  synced_sold: number;
  balance: number;
  status: StockStatus;
}

async function endSession(): Promise<void> {
  await clearAdminSession();
  useSessionStore.getState().setAdminSession(null);
}

/** Petición con el token de admin. Vencida o con 401, se borra la sesión y la app vuelve al login (RF-8, CA-7). */
async function adminFetch<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const session = useSessionStore.getState().adminSession;
  if (!isSessionValid(session, Date.now())) {
    await endSession();
    throw new ApiError(401, 'UNAUTHORIZED', 'La sesión de administrador venció');
  }
  try {
    return await apiFetch<T>(path, { method, secret: session.token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) await endSession();
    throw error;
  }
}

/** RF-5, RF-6: el servidor responde lo mismo ante cualquier error de credenciales. */
export async function login(username: string, password: string): Promise<void> {
  const session = await apiFetch<AdminSession>('/admin/login', { method: 'POST', body: { username, password } });
  await saveAdminSession(session);
  useSessionStore.getState().setAdminSession(session);
}

/** Cierra la sesión en el servidor si hay red; en el teléfono se borra siempre. */
export async function logout(): Promise<void> {
  try {
    await adminFetch('/admin/logout', 'POST');
  } catch {
    // Sin red o ya vencida: la sesión del servidor vence sola a las 8 h.
  } finally {
    await endSession();
  }
}

export const getSales = ({ from, to }: { from: string; to: string }) =>
  adminFetch<SalesSummary>(`/admin/sales?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

export const getStock = () => adminFetch<{ generated_at: string; products: StockProduct[] }>('/admin/stock');
