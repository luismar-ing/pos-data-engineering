import { getDatabase } from '../../../core/db/database';
import { capFrom } from '../../leases/domain/leasePolicy';
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

type Db = Awaited<ReturnType<typeof getDatabase>>;

/** Ventas de la ventana y Runout Time por producto (SPEC-009 RF-3..RF-6). */
async function getRunout(db: Db, nowMs: number) {
  const windowRows = await db.getAllAsync<WindowRow & { first_sale_at: string }>(WINDOW_SALES_SQL, [
    new Date(nowMs - WINDOW_MINUTES * 60_000).toISOString(),
  ]);
  const leases = await db.getAllAsync<LeaseRow>(LEASE_AVAILABLE_SQL, [capFrom(nowMs)]);
  const firstSaleMs = windowRows.length ? Math.min(...windowRows.map((row) => Date.parse(row.first_sale_at))) : null;
  const minutes = windowMinutes(nowMs, firstSaleMs);
  return { windowRows, minutes, ...buildRunout(windowRows, leases, minutes) };
}

/** Productos que se agotan en menos de LOW_RUNOUT_MINUTES a su ritmo, para Venta e Inventario (SPEC-012 P2). */
export async function getLowStockIds(nowMs: number): Promise<Set<string>> {
  const { items } = await getRunout(await getDatabase(), nowMs);
  return new Set(items.filter((item) => item.low).map((item) => item.productId));
}

/** Calcula el panel con los datos del teléfono (SPEC-009). Solo lee; funciona sin red (RF-11). */
export async function getDashboard(nowMs: number): Promise<Dashboard> {
  const started = Date.now();
  const db = await getDatabase();
  const session = await db.getFirstAsync<DashboardSession>(TARGET_SESSION_SQL);
  const { windowRows, minutes, items, idle } = await getRunout(db, nowMs);

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
