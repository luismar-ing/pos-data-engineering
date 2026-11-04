import type { PoolClient } from 'pg';
import { HttpError } from '../http/errors.js';

/** SPEC-005 P7: ventana de la tasa, duración del préstamo, margen y mínimo. */
export const LEASE_PARAMS = { windowMinutes: 5, leaseMinutes: 3, margin: 1.2, minQty: 5 } as const;

/**
 * Cuota a prestar (SPEC-005 RF-2): tasa del dispositivo × duración × margen, con mínimo y tope en el stock central.
 * `units` y `minutes` salen de los préstamos que ese dispositivo cerró dentro de la ventana.
 */
export function calculateLeaseQty({ units, minutes, centralStock }: { units: number; minutes: number; centralStock: number }): number {
    if (centralStock <= 0) return 0;
    const raw = (units * LEASE_PARAMS.leaseMinutes * LEASE_PARAMS.margin) / Math.max(minutes, 1);
    const estimated = Math.ceil(raw - 1e-9); // 1.2 no es exacto en binario: sin esto, 12.000000001 daría 13
    return Math.min(Math.max(estimated, LEASE_PARAMS.minQty), centralStock);
}

export interface Lease {
    id: string;
    product_id: string;
    quota_total: number;
    quota_used: number;
    issued_at: Date;
    expires_at: Date;
}

const LEASE_COLUMNS = 'id, product_id, quota_total, quota_used, issued_at, expires_at';

/**
 * Devuelve el préstamo activo de cada producto; si no hay, lo emite y congela su cuota (RF-1..RF-5).
 * Correr dentro de una transacción. Bloquea los productos en orden de id para no cruzarse con otras peticiones.
 */
export async function requestLeases(client: PoolClient, deviceId: string, productIds: string[]) {
    const leases: Lease[] = [];
    const unavailable: string[] = [];
    for (const productId of [...productIds].sort()) {
        const lease = await issueLease(client, deviceId, productId);
        if (lease) leases.push(lease);
        else unavailable.push(productId);
    }
    return { leases, unavailable };
}

async function issueLease(client: PoolClient, deviceId: string, productId: string): Promise<Lease | null> {
    // RF-3: con la fila bloqueada, otro pedido del mismo producto espera y ve el stock ya descontado.
    const { rows: [product] } = await client.query<{ central_stock: number; active: boolean }>(
        'select central_stock, active from products where id = $1 for update',
        [productId]
    );
    if (!product?.active) return null;

    const { rows: [existing] } = await client.query<Lease>(
        `select ${LEASE_COLUMNS} from stock_leases where device_id = $1 and product_id = $2 and status = 'active'`,
        [deviceId, productId]
    );
    if (existing) return existing;

    const { rows: [usage] } = await client.query<{ units: string; minutes: string }>(
        `select coalesce(sum(quota_used), 0) as units,
                coalesce(sum(extract(epoch from closed_at - issued_at)), 0) / 60 as minutes
         from stock_leases
         where device_id = $1 and product_id = $2 and closed_at > now() - make_interval(mins => $3)`,
        [deviceId, productId, LEASE_PARAMS.windowMinutes]
    );
    const qty = calculateLeaseQty({ units: Number(usage!.units), minutes: Number(usage!.minutes), centralStock: product.central_stock });
    if (qty === 0) return null; // RF-4

    await client.query('update products set central_stock = central_stock - $2 where id = $1', [productId, qty]);
    const { rows: [lease] } = await client.query<Lease>(
        `insert into stock_leases (device_id, product_id, quota_total, expires_at)
         values ($1, $2, $3, now() + make_interval(mins => $4))
         returning ${LEASE_COLUMNS}`,
        [deviceId, productId, qty, LEASE_PARAMS.leaseMinutes]
    );
    return lease!; // insert … returning siempre da una fila
}

/**
 * Cierra préstamos con lo vendido que informa el dispositivo y devuelve el resto al stock central (RF-11, RF-13, RF-15).
 * Cerrar uno ya cerrado con el mismo valor no hace nada (RF-12). Correr dentro de una transacción.
 */
export async function closeLeases(client: PoolClient, deviceId: string, items: { lease_id: string; quota_used: number }[]) {
    const { rows: refs } = await client.query<{ id: string; product_id: string }>(
        'select id, product_id from stock_leases where id = any($1) and device_id = $2',
        [items.map((item) => item.lease_id), deviceId]
    );
    const productOf = new Map(refs.map((ref) => [ref.id, ref.product_id]));
    if (productOf.size !== items.length) {
        throw new HttpError(404, 'LEASE_NOT_FOUND', 'El préstamo no existe o es de otro dispositivo');
    }

    // Mismo orden de bloqueo que requestLeases: primero el producto.
    const ordered = [...items].sort((a, b) => productOf.get(a.lease_id)!.localeCompare(productOf.get(b.lease_id)!));
    for (const item of ordered) {
        const productId = productOf.get(item.lease_id)!;
        await client.query('select 1 from products where id = $1 for update', [productId]);
        const { rows: [lease] } = await client.query<{ quota_total: number; quota_used: number; status: string }>(
            'select quota_total, quota_used, status from stock_leases where id = $1 for update',
            [item.lease_id]
        );
        if (!lease) throw new HttpError(404, 'LEASE_NOT_FOUND', 'El préstamo no existe o es de otro dispositivo');
        const closed = lease.status !== 'active';
        // P6: nunca más que la cuota ni menos que lo informado; si ya estaba cerrado, el reintento debe traer lo mismo.
        if (item.quota_used > lease.quota_total || item.quota_used < lease.quota_used || (closed && item.quota_used !== lease.quota_used)) {
            throw new HttpError(400, 'INVALID_QUOTA_USED', 'La cantidad vendida informada no es válida para este préstamo');
        }
        if (closed) continue;

        await client.query(
            `update stock_leases set status = 'released', quota_used = $2, closed_at = now() where id = $1`,
            [item.lease_id, item.quota_used]
        );
        await client.query('update products set central_stock = central_stock + $2 where id = $1', [
            productId,
            lease.quota_total - item.quota_used,
        ]);
    }
    return { closed: items.map((item) => item.lease_id) };
}
