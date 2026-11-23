// SPEC-015: catálogo, historial y reinicio para la demo. Solo desarrollo: cli.ts llama antes a assertDevDatabase.
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { seed } from '../db/migrate.js';
import { setAdmin } from '../services/adminAuthService.js';

export interface DemoProduct {
    id: string;
    name: string;
    category: string;
    unit_price_cents: number;
    stock: number;
}

/** Ids fijos. Los 5 primeros son los del seed de desarrollo (P1). */
export const ID = {
    agua: '11111111-1111-4111-8111-111111111111',
    refresco: '22222222-2222-4222-8222-222222222222',
    cerveza: '33333333-3333-4333-8333-333333333333',
    papas: '44444444-4444-4444-8444-444444444444',
    hotDog: '55555555-5555-4555-8555-555555555555',
    horchata: 'd0000000-0000-4000-8000-000000000006',
    cafe: 'd0000000-0000-4000-8000-000000000007',
    hamburguesa: 'd0000000-0000-4000-8000-000000000008',
    elote: 'd0000000-0000-4000-8000-000000000009',
    tacos: 'd0000000-0000-4000-8000-000000000010',
    pizza: 'd0000000-0000-4000-8000-000000000011',
    palomitas: 'd0000000-0000-4000-8000-000000000012',
    nachos: 'd0000000-0000-4000-8000-000000000013',
    cacahuates: 'd0000000-0000-4000-8000-000000000014',
    algodon: 'd0000000-0000-4000-8000-000000000015',
    churros: 'd0000000-0000-4000-8000-000000000016',
    paleta: 'd0000000-0000-4000-8000-000000000017',
    gorra: 'd0000000-0000-4000-8000-000000000018',
    playera: 'd0000000-0000-4000-8000-000000000019',
    pulsera: 'd0000000-0000-4000-8000-000000000020',
} as const;

const product = (id: string, name: string, category: string, unit_price_cents: number, stock: number): DemoProduct => ({ id, name, category, unit_price_cents, stock });

/** RF-1: "Hot dog" en 10 para mostrar el bloqueo por cuota agotada. */
export const DEMO_PRODUCTS: DemoProduct[] = [
    product(ID.agua, 'Agua 600 ml', 'Bebidas', 1500, 200),
    product(ID.refresco, 'Refresco 355 ml', 'Bebidas', 2200, 150),
    product(ID.cerveza, 'Cerveza 355 ml', 'Bebidas', 4500, 300),
    product(ID.horchata, 'Agua de horchata 500 ml', 'Bebidas', 3000, 80),
    product(ID.cafe, 'Café americano', 'Bebidas', 2500, 60),
    product(ID.hotDog, 'Hot dog', 'Comida', 5500, 10),
    product(ID.hamburguesa, 'Hamburguesa', 'Comida', 8500, 60),
    product(ID.elote, 'Elote en vaso', 'Comida', 4000, 80),
    product(ID.tacos, 'Tacos al pastor (3)', 'Comida', 6000, 100),
    product(ID.pizza, 'Pizza (rebanada)', 'Comida', 4500, 70),
    product(ID.papas, 'Papas fritas', 'Snacks', 2500, 80),
    product(ID.palomitas, 'Palomitas', 'Snacks', 3500, 120),
    product(ID.nachos, 'Nachos con queso', 'Snacks', 5000, 90),
    product(ID.cacahuates, 'Cacahuates', 'Snacks', 2000, 100),
    product(ID.algodon, 'Algodón de azúcar', 'Dulces', 3000, 50),
    product(ID.churros, 'Churros (3)', 'Dulces', 3500, 80),
    product(ID.paleta, 'Paleta helada', 'Dulces', 2500, 100),
    product(ID.gorra, 'Gorra del evento', 'Recuerdos', 25000, 40),
    product(ID.playera, 'Playera del evento', 'Recuerdos', 35000, 40),
    product(ID.pulsera, 'Pulsera luminosa', 'Recuerdos', 8000, 150),
];

export const DEMO_DEVICE_ID = 'demo-caja-2';
const DEMO_DEVICE_NAME = 'Caja 2 (demo)';
const DEMO_SELLER = 'Ana (demo)';

// RF-4, P3: líneas [producto, cantidad] que se repiten en orden. Sin "Hot dog": sus 10 son para los teléfonos de la demo.
const SALE_PATTERNS: [string, number][][] = [
    [[ID.cerveza, 2]],
    [[ID.agua, 1], [ID.papas, 1]],
    [[ID.tacos, 1], [ID.refresco, 1]],
    [[ID.cerveza, 3], [ID.nachos, 1]],
    [[ID.hamburguesa, 1], [ID.refresco, 1]],
    [[ID.agua, 2]],
    [[ID.elote, 1], [ID.horchata, 1]],
    [[ID.pulsera, 2]],
    [[ID.palomitas, 1], [ID.refresco, 2]],
    [[ID.churros, 1], [ID.cafe, 1]],
    [[ID.gorra, 1]],
    [[ID.cerveza, 1], [ID.pizza, 1]],
];
const PAYMENTS = ['cash', 'card', 'transfer'] as const;
const WINDOWS = 3;
const SALES_PER_WINDOW = 10;
const LEFTOVER = 3; // cuota que el teléfono no vendió y devolvió al cerrar
const MIN = 60_000;

export interface DemoLease { id: string; product_id: string; quota_total: number; quota_used: number; issued_at: Date; closed_at: Date }
export interface DemoSale {
    id: string;
    window: number;
    created_at: Date;
    payment_method: string;
    total_cents: number;
    items: { id: string; product_id: string; quantity: number; unit_price_cents: number; lease_id: string }[];
}

/** 30 ventas de hace 118 a 22 min en 3 ventanas, cada una con un préstamo cerrado por producto (P3). */
export function demoHistory(now: Date): { sales: DemoSale[]; leases: DemoLease[] } {
    const price = new Map(DEMO_PRODUCTS.map((p) => [p.id, p.unit_price_cents]));
    const at = (i: number) => new Date(now.getTime() - (118 - i * 3.3) * MIN);
    const sales: DemoSale[] = [];
    const leases: DemoLease[] = [];
    for (let w = 0; w < WINDOWS; w++) {
        const first = w * SALES_PER_WINDOW;
        const last = first + SALES_PER_WINDOW - 1;
        const byProduct = new Map<string, DemoLease>();
        for (let i = first; i <= last; i++) {
            const items = SALE_PATTERNS[i % SALE_PATTERNS.length]!.map(([product_id, quantity]) => {
                let lease = byProduct.get(product_id);
                if (!lease) {
                    lease = { id: randomUUID(), product_id, quota_total: 0, quota_used: 0, issued_at: new Date(at(first).getTime() - MIN), closed_at: new Date(at(last).getTime() + 2 * MIN) };
                    byProduct.set(product_id, lease);
                }
                lease.quota_used += quantity;
                return { id: randomUUID(), product_id, quantity, unit_price_cents: price.get(product_id)!, lease_id: lease.id };
            });
            const total_cents = items.reduce((sum, item) => sum + item.quantity * item.unit_price_cents, 0);
            sales.push({ id: randomUUID(), window: w, created_at: at(i), payment_method: PAYMENTS[i % PAYMENTS.length]!, total_cents, items });
        }
        for (const lease of byProduct.values()) leases.push({ ...lease, quota_total: lease.quota_used + LEFTOVER });
    }
    return { sales, leases };
}

const CLEAR_TABLES = ['sync_events', 'sale_items', 'sales', 'sessions', 'stock_leases', 'admin_audit'];

/** RF-2..RF-5: estado inicial de la demo. Conserva teléfonos y cuentas de administrador (RF-3). */
export async function resetDemo(pool: Pool, now = new Date()): Promise<void> {
    await seed(pool); // asegura el seed de desarrollo, como resetScenario
    const { sales, leases } = demoHistory(now);
    const sold = new Map<string, number>();
    for (const lease of leases) sold.set(lease.product_id, (sold.get(lease.product_id) ?? 0) + lease.quota_used);

    const client = await pool.connect();
    try {
        await client.query('begin');
        for (const table of CLEAR_TABLES) await client.query(`delete from ${table}`);

        // Central = inicial − lo vendido en el historial: central + 0 prestado + informado = inicial (RF-5).
        for (const p of DEMO_PRODUCTS) {
            await client.query(
                `insert into products (id, name, category, unit_price_cents, central_stock, initial_stock, active)
                 values ($1, $2, $3, $4, $5, $6, true)
                 on conflict (id) do update set name = excluded.name, category = excluded.category, unit_price_cents = excluded.unit_price_cents,
                     central_stock = excluded.central_stock, initial_stock = excluded.initial_stock, active = true`,
                [p.id, p.name, p.category, p.unit_price_cents, p.stock - (sold.get(p.id) ?? 0), p.stock]
            );
        }
        // Productos de pruebas: fuera del catálogo y cuadrando sin préstamos ni ventas.
        await client.query('update products set active = false, initial_stock = central_stock where not (id = any($1::uuid[]))', [DEMO_PRODUCTS.map((p) => p.id)]);
        await client.query('update devices set revoked_at = null where revoked_at is not null');
        // Registros viejos ensucian "Por teléfono"; si uno vuelve, la app se registra de nuevo al abrir (insert … on conflict do nothing).
        await client.query(`delete from devices where id <> $1 and (last_seen_at is null or last_seen_at < $2::timestamptz - interval '24 hours')`, [DEMO_DEVICE_ID, now]);

        const lastSale = sales.at(-1)!.created_at.getTime();
        // Sin token_hash: el teléfono de demo no puede autenticarse, solo aporta datos (P3).
        await client.query(
            `insert into devices (id, name, last_seen_at) values ($1, $2, $3)
             on conflict (id) do update set name = excluded.name, last_seen_at = excluded.last_seen_at, token_hash = null`,
            [DEMO_DEVICE_ID, DEMO_DEVICE_NAME, new Date(lastSale + 2 * MIN)]
        );
        const sessionId = randomUUID();
        await client.query('insert into sessions (id, device_id, seller_name, opened_at, closed_at) values ($1, $2, $3, $4, $5)', [
            sessionId, DEMO_DEVICE_ID, DEMO_SELLER, new Date(sales[0]!.created_at.getTime() - 2 * MIN), new Date(lastSale + 2 * MIN),
        ]);
        for (const l of leases) {
            await client.query(
                `insert into stock_leases (id, device_id, product_id, quota_total, quota_used, status, issued_at, expires_at, closed_at)
                 values ($1, $2, $3, $4, $5, 'released', $6, $7, $7)`,
                [l.id, DEMO_DEVICE_ID, l.product_id, l.quota_total, l.quota_used, l.issued_at, l.closed_at]
            );
        }
        const batches = Array.from({ length: WINDOWS }, () => randomUUID());
        for (const s of sales) {
            const receivedAt = new Date(s.created_at.getTime() + MIN);
            await client.query('insert into sales (id, device_id, total_cents, payment_method, created_at, received_at, session_id) values ($1, $2, $3, $4, $5, $6, $7)', [
                s.id, DEMO_DEVICE_ID, s.total_cents, s.payment_method, s.created_at, receivedAt, sessionId,
            ]);
            for (const item of s.items) {
                await client.query('insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents, lease_id) values ($1, $2, $3, $4, $5, $6)', [
                    item.id, s.id, item.product_id, item.quantity, item.unit_price_cents, item.lease_id,
                ]);
            }
            await client.query(`insert into sync_events (event_id, device_id, event_type, batch_id, received_at) values ($1, $2, 'sale_created', $3, $4)`, [
                s.id, DEMO_DEVICE_ID, batches[s.window], receivedAt,
            ]);
        }
        await client.query('commit');
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}

/** SPEC-016 RF-2, RF-3: arranque del servidor de demo (ADR-0009). Carga la demo solo con la base vacía y crea el administrador solo si no existe. */
export async function initDemo(pool: Pool, admin: { username?: string | undefined; password?: string | undefined }): Promise<{ demoLoaded: boolean; adminCreated: boolean }> {
    const { rows: [products] } = await pool.query<{ n: number }>('select count(*)::int as n from products');
    const demoLoaded = products!.n === 0;
    if (demoLoaded) await resetDemo(pool);

    let adminCreated = false;
    if (admin.username && admin.password) {
        const { rows: [existing] } = await pool.query<{ n: number }>('select count(*)::int as n from admins where username = $1', [admin.username]);
        if (existing!.n === 0) adminCreated = (await setAdmin(pool, admin.username, admin.password)).created; // nunca cambia una contraseña existente
    }
    return { demoLoaded, adminCreated };
}
