import { getDatabase } from '../../../core/db/database';
import {
  averageTicketCents,
  buildRunout,
  burnRate,
  TOP_LIMIT,
  WINDOW_MINUTES,
  windowMinutes,
  type LeaseRow,
  type RunoutItem,
  type WindowRow,
} from '../domain/metrics';
import {
  LEASE_AVAILABLE_SQL,
  SESSION_TOTALS_SQL,
  SESSION_UNITS_SQL,
  TARGET_SESSION_SQL,
  TOP_PRODUCTS_SQL,
  WINDOW_SALES_SQL,
} from './analyticsSql';

export interface DashboardSession {
  id: string;
  seller_name: string;
  opened_at: string;
  closed_at: string | null;
}

export interface TopProduct {
  product_id: string;
  name: string;
  units: number;
  revenue_cents: number;
}

export interface Dashboard {
  /** Unidades por minuto de todos los productos (RF-2). */
  burnRate: number;
  runout: RunoutItem[];
  /** Préstamos con cuota y sin ventas en la ventana (P7). */
  idleLeases: number;
  session: DashboardSession | null;
  top: TopProduct[];
  totals: { sales: number; units: number; revenueCents: number; averageTicketCents: number } | null;
}

/** Calcula el panel con los datos del teléfono (SPEC-009). Solo lee; funciona sin red (RF-11). */
export async function getDashboard(nowMs: number): Promise<Dashboard> {
  const started = Date.now();
  const db = await getDatabase();
  const session = await db.getFirstAsync<DashboardSession>(TARGET_SESSION_SQL);
  const windowRows = await db.getAllAsync<WindowRow & { first_sale_at: string }>(WINDOW_SALES_SQL, [
    new Date(nowMs - WINDOW_MINUTES * 60_000).toISOString(),
  ]);
  const leases = await db.getAllAsync<LeaseRow>(LEASE_AVAILABLE_SQL);

  const firstSaleMs = windowRows.length ? Math.min(...windowRows.map((row) => Date.parse(row.first_sale_at))) : null;
  const minutes = windowMinutes(nowMs, firstSaleMs);
  const { items, idle } = buildRunout(windowRows, leases, minutes);

  let top: TopProduct[] = [];
  let totals: Dashboard['totals'] = null;
  if (session) {
    top = await db.getAllAsync<TopProduct>(TOP_PRODUCTS_SQL, [session.id, TOP_LIMIT]);
    const sums = await db.getFirstAsync<{ sales: number; revenue_cents: number }>(SESSION_TOTALS_SQL, [session.id]);
    const units = await db.getFirstAsync<{ units: number }>(SESSION_UNITS_SQL, [session.id]);
    const sales = sums?.sales ?? 0;
    const revenueCents = sums?.revenue_cents ?? 0;
    totals = { sales, units: units?.units ?? 0, revenueCents, averageTicketCents: averageTicketCents(revenueCents, sales) };
  }

  if (__DEV__) console.log(`Panel calculado en ${Date.now() - started} ms`);
  return {
    burnRate: burnRate(windowRows.reduce((sum, row) => sum + row.units, 0), minutes),
    runout: items,
    idleLeases: idle,
    session,
    top,
    totals,
  };
}
