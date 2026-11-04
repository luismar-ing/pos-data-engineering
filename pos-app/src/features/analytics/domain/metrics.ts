// SPEC-009: fórmulas del panel. Puras: test/analytics.test.mjs las prueba con node.

export const WINDOW_MINUTES = 10; // P1
export const LOW_RUNOUT_MINUTES = 5; // P5
export const TOP_LIMIT = 5; // P4

const MINUTE_MS = 60_000;

/**
 * Minutos que cubre el Burn Rate (P1): desde la primera venta del teléfono dentro de la ventana de 10 min,
 * sin importar la sesión, para que un pico se note de inmediato. Nunca menos de 1 ni más de 10.
 */
export function windowMinutes(nowMs: number, firstSaleMs: number | null): number {
  if (firstSaleMs === null) return WINDOW_MINUTES;
  return Math.min(Math.max((nowMs - firstSaleMs) / MINUTE_MS, 1), WINDOW_MINUTES);
}

/** Burn Rate: unidades por minuto (RF-1, RF-2). */
export const burnRate = (units: number, minutes: number) => units / minutes;

export interface WindowRow {
  product_id: string;
  name: string;
  units: number;
}

export interface LeaseRow {
  product_id: string;
  name: string;
  available: number;
}

export interface RunoutItem {
  productId: string;
  name: string;
  ratePerMin: number;
  /** Minutos hasta agotar la cuota; 0 si ya está agotado. */
  minutesLeft: number;
  soldOut: boolean;
  /** Se agota en menos de LOW_RUNOUT_MINUTES (RF-5). */
  low: boolean;
}

/**
 * Runout Time (RF-3..RF-6, P7): productos con ventas en la ventana y préstamos agotados,
 * agotados primero y luego del que se acaba antes. Los préstamos con cuota y sin ventas solo se cuentan.
 */
export function buildRunout(windowRows: WindowRow[], leases: LeaseRow[], minutes: number) {
  const leaseOf = new Map(leases.map((lease) => [lease.product_id, lease]));
  const selling = new Set(windowRows.map((row) => row.product_id));
  const items: RunoutItem[] = windowRows.map((row) => {
    const ratePerMin = burnRate(row.units, minutes);
    const available = leaseOf.get(row.product_id)?.available ?? 0; // sin préstamo = agotado
    const minutesLeft = available / ratePerMin;
    return { productId: row.product_id, name: row.name, ratePerMin, minutesLeft, soldOut: available === 0, low: available > 0 && minutesLeft < LOW_RUNOUT_MINUTES };
  });
  for (const lease of leases) {
    if (lease.available === 0 && !selling.has(lease.product_id)) {
      items.push({ productId: lease.product_id, name: lease.name, ratePerMin: 0, minutesLeft: 0, soldOut: true, low: false });
    }
  }
  items.sort((a, b) => Number(b.soldOut) - Number(a.soldOut) || a.minutesLeft - b.minutesLeft || a.name.localeCompare(b.name));
  const idle = leases.filter((lease) => lease.available > 0 && !selling.has(lease.product_id)).length;
  return { items, idle };
}

/** Ticket promedio en centavos enteros; 0 sin ventas (RF-8, RNF-3). */
export const averageTicketCents = (revenueCents: number, sales: number) => (sales > 0 ? Math.round(revenueCents / sales) : 0);
