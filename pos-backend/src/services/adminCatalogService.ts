// SPEC-014 RF-13..RF-17: catálogo y stock central desde el panel.
import type { PoolClient } from 'pg';
import { HttpError } from '../http/errors.js';
import type { Change } from './adminAuditService.js';

export interface AdminProduct {
    id: string;
    name: string;
    category: string | null;
    unit_price_cents: number;
    active: boolean;
    central_stock: number;
    initial_stock: number | null;
}

export interface ProductPatch {
    name?: string | undefined;
    category?: string | null | undefined;
    unit_price_cents?: number | undefined;
    active?: boolean | undefined;
}

const PRODUCT_COLUMNS = 'id, name, category, unit_price_cents, active, central_stock, initial_stock';

/** Bloquea la fila: un pedido de préstamo del mismo producto espera (RNF-3, mismo bloqueo que SPEC-005 RF-3). */
async function lockProduct(client: PoolClient, id: string): Promise<AdminProduct> {
    const { rows: [product] } = await client.query<AdminProduct>(`select ${PRODUCT_COLUMNS} from products where id = $1 for update`, [id]);
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'El producto no existe');
    return product;
}

/** RF-13: el stock inicial es también el central (RF-17). */
export async function createProduct(
    client: PoolClient,
    input: { name: string; category?: string | undefined; unit_price_cents: number; initial_stock: number }
): Promise<Change<AdminProduct>> {
    const { rows: [after] } = await client.query<AdminProduct>(
        `insert into products (name, category, unit_price_cents, central_stock, initial_stock)
         values ($1, $2, $3, $4, $4) returning ${PRODUCT_COLUMNS}`,
        [input.name, input.category ?? null, input.unit_price_cents, input.initial_stock]
    );
    return { entityId: after!.id, before: null, after: after! };
}

/** RF-14, RF-16: nombre, categoría, precio y activo. No toca el stock. */
export async function updateProduct(client: PoolClient, id: string, patch: ProductPatch): Promise<Change<AdminProduct>> {
    const before = await lockProduct(client, id);
    // Un campo ausente (undefined) no cambia; `category: null` sí la borra.
    const next = { ...before, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    const { rows: [after] } = await client.query<AdminProduct>(
        `update products set name = $2, category = $3, unit_price_cents = $4, active = $5 where id = $1 returning ${PRODUCT_COLUMNS}`,
        [id, next.name, next.category, next.unit_price_cents, next.active]
    );
    return { entityId: id, before, after: after! };
}

/** RF-15, RF-17: solo el central (nunca bajo 0) y el inicial con el mismo delta; lo prestado no cambia. */
export async function adjustStock(client: PoolClient, id: string, delta: number): Promise<Change<AdminProduct>> {
    const before = await lockProduct(client, id);
    if (before.central_stock + delta < 0) {
        throw new HttpError(409, 'STOCK_BELOW_ZERO', `El stock central quedaría en ${before.central_stock + delta}; hay ${before.central_stock}`);
    }
    const { rows: [after] } = await client.query<AdminProduct>(
        `update products set central_stock = central_stock + $2, initial_stock = initial_stock + $2 where id = $1 returning ${PRODUCT_COLUMNS}`,
        [id, delta]
    );
    return { entityId: id, before, after: after! };
}
