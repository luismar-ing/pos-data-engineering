import { randomUUID } from 'expo-crypto';
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
  category: string | null;
  unit_price_cents: number;
  active: boolean;
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
async function adminFetch<T>(path: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
  const session = useSessionStore.getState().adminSession;
  if (!isSessionValid(session, Date.now())) {
    await endSession();
    throw new ApiError(401, 'UNAUTHORIZED', 'La sesión de administrador venció');
  }
  try {
    return await apiFetch<T>(path, { method, secret: session.token, body });
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

// SPEC-014: dispositivos, conciliación, catálogo y registro de cambios.

export interface DeviceLease {
  id: string;
  product_id: string;
  product_name: string;
  quota_total: number;
  quota_used: number;
  expires_at: string;
  /** Cuándo vuelve al stock central; solo con el dispositivo dado de baja (ADR-0008). */
  release_at: string | null;
}

export interface AdminDevice {
  id: string;
  name: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
  open_session: { seller_name: string; opened_at: string } | null;
  leases: DeviceLease[];
}

export type ReconciliationResult = 'cuadra' | 'faltan_ventas' | 'sobran_ventas';

export interface Reconciliation {
  generated_at: string;
  leases: {
    lease_id: string;
    device_id: string;
    device_name: string | null;
    product_id: string;
    product_name: string;
    status: 'released' | 'expired';
    closed_at: string;
    reported: number;
    synced: number;
    result: ReconciliationResult;
    returned_extra: number;
  }[];
  unassigned: { device_id: string; device_name: string | null; product_id: string; product_name: string; units: number }[];
}

export interface AdminProduct {
  id: string;
  name: string;
  category: string | null;
  unit_price_cents: number;
  active: boolean;
  central_stock: number;
  initial_stock: number | null;
}

export interface AuditEntry {
  request_id: string;
  username: string;
  action: 'device_revoke' | 'device_reactivate' | 'product_create' | 'product_update' | 'stock_adjust';
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  created_at: string;
}

// RNF-2: una acción que falló por red conserva su request_id; el reintento no aplica dos veces en el servidor.
const pendingIds = new Map<string, string>();

async function adminAction<T>(key: string, path: string, method: 'POST' | 'PATCH', body: object): Promise<T> {
  const requestId = pendingIds.get(key) ?? randomUUID();
  pendingIds.set(key, requestId);
  try {
    const result = await adminFetch<T>(path, method, { ...body, request_id: requestId });
    pendingIds.delete(key);
    return result;
  } catch (error) {
    // Solo sin respuesta puede haberse aplicado sin saberlo; cualquier respuesta del servidor cierra la acción.
    if (!(error instanceof ApiError && error.code === 'NETWORK_ERROR')) pendingIds.delete(key);
    throw error;
  }
}

export const getDevices = () => adminFetch<{ generated_at: string; devices: AdminDevice[] }>('/admin/devices');

export const setDeviceRevoked = (deviceId: string, revoked: boolean) =>
  adminAction<{ device: AdminDevice }>(
    `device:${deviceId}:${revoked}`,
    `/admin/devices/${encodeURIComponent(deviceId)}/${revoked ? 'revoke' : 'reactivate'}`,
    'POST',
    {}
  );

export const getReconciliation = ({ from, to }: { from: string; to: string }) =>
  adminFetch<Reconciliation>(`/admin/reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

export const createProduct = (input: { name: string; category?: string; unit_price_cents: number; initial_stock: number }) =>
  adminAction<{ product: AdminProduct }>('product:create', '/admin/products', 'POST', input);

export const updateProduct = (
  id: string,
  patch: { name?: string; category?: string | null; unit_price_cents?: number; active?: boolean }
) => adminAction<{ product: AdminProduct }>(`product:${id}:update`, `/admin/products/${id}`, 'PATCH', patch);

export const adjustStock = (id: string, delta: number) =>
  adminAction<{ product: AdminProduct }>(`product:${id}:stock`, `/admin/products/${id}/stock`, 'POST', { delta });

export const getAudit = () => adminFetch<{ entries: AuditEntry[] }>('/admin/audit?limit=50');
