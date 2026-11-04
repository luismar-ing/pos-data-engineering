import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../db/pool.js';

const isoDate = z.iso.datetime({ offset: true });
const base = { event_id: z.uuid(), device_id: z.string().min(1), created_at: isoDate };

// Forma de cada tipo (SPEC-008 plan §5). El payload es el payload_json de event_log en la app.
const saleCreated = z
    .object({
        ...base,
        event_type: z.literal('sale_created'),
        payload: z.object({
            sale: z.object({
                id: z.uuid(),
                device_id: z.string(),
                total_cents: z.number().int().min(0),
                payment_method: z.string().min(1),
                created_at: isoDate,
                session_id: z.uuid().nullable().optional(),
            }),
            items: z
                .array(
                    z.object({
                        id: z.uuid(),
                        sale_id: z.uuid(),
                        product_id: z.uuid(),
                        quantity: z.number().int().positive(),
                        unit_price_cents: z.number().int().min(0),
                    })
                )
                .min(1),
        }),
    })
    .refine((e) => e.payload.sale.id === e.event_id, { message: 'sale.id debe ser igual a event_id', path: ['payload', 'sale', 'id'] })
    .refine((e) => e.payload.items.every((item) => item.sale_id === e.event_id), { message: 'items[].sale_id debe ser igual a event_id', path: ['payload', 'items'] })
    .refine((e) => e.payload.sale.total_cents === e.payload.items.reduce((sum, i) => sum + i.quantity * i.unit_price_cents, 0), {
        message: 'total_cents debe ser la suma de las líneas',
        path: ['payload', 'sale', 'total_cents'],
    });

const session = { id: z.uuid(), device_id: z.string(), seller_name: z.string().trim().min(1), opened_at: isoDate };
const sessionOpened = z.object({
    ...base,
    event_type: z.literal('session_opened'),
    payload: z.object({ session: z.object({ ...session, closed_at: z.null() }) }),
});
const sessionClosed = z.object({
    ...base,
    event_type: z.literal('session_closed'),
    payload: z.object({ session: z.object({ ...session, closed_at: isoDate }) }),
});

const schemas = { sale_created: saleCreated, session_opened: sessionOpened, session_closed: sessionClosed } as const;
type SyncEvent = z.infer<typeof saleCreated> | z.infer<typeof sessionOpened> | z.infer<typeof sessionClosed>;

export type EventResult =
    | { event_id: string; status: 'inserted' | 'duplicate' }
    | { event_id: string; status: 'rejected'; reason: string };

function payloadDeviceId(event: SyncEvent): string {
    return event.event_type === 'sale_created' ? event.payload.sale.device_id : event.payload.session.device_id;
}

/** Valida un evento; un problema de forma o de dispositivo es un rechazo, no un error (RF-8). */
function parse(raw: { event_id: string; event_type?: unknown }, deviceId: string): SyncEvent | string {
    const schema = schemas[raw.event_type as keyof typeof schemas];
    if (!schema) return `event_type desconocido: ${String(raw.event_type)}`;
    const result = schema.safeParse(raw);
    if (!result.success) {
        const issue = result.error.issues[0]!;
        return `${issue.path.join('.')}: ${issue.message}`;
    }
    if (result.data.device_id !== deviceId || payloadDeviceId(result.data) !== deviceId) {
        return 'El evento pertenece a otro dispositivo';
    }
    return result.data;
}

async function apply(client: PoolClient, event: SyncEvent): Promise<void> {
    if (event.event_type === 'sale_created') {
        const { sale, items } = event.payload;
        await client.query(
            `insert into sales (id, device_id, total_cents, payment_method, created_at, session_id)
             values ($1, $2, $3, $4, $5, $6)`,
            [sale.id, sale.device_id, sale.total_cents, sale.payment_method, sale.created_at, sale.session_id ?? null]
        );
        for (const item of items) {
            await client.query(
                'insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values ($1, $2, $3, $4, $5)',
                [item.id, item.sale_id, item.product_id, item.quantity, item.unit_price_cents]
            );
        }
        return; // RF-11: el stock ya salió al prestarse; aquí no se toca central_stock
    }

    // RF-10: apertura y cierre pueden llegar en cualquier orden; ninguno pisa lo que ya llegó.
    const s = event.payload.session;
    await client.query(
        `insert into sessions (id, device_id, seller_name, opened_at, closed_at)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do update set
             opened_at = coalesce(sessions.opened_at, excluded.opened_at),
             closed_at = coalesce(sessions.closed_at, excluded.closed_at)
         where sessions.device_id = excluded.device_id`,
        [s.id, s.device_id, s.seller_name, s.opened_at, s.closed_at]
    );
}

/** Un evento en su propia transacción: duplicado, guardado o rechazado por una restricción (RF-7, RF-9). */
async function applyEvent(client: PoolClient, deviceId: string, batchId: string, event: SyncEvent): Promise<EventResult> {
    await client.query('begin');
    try {
        const { rowCount } = await client.query(
            `insert into sync_events (event_id, device_id, event_type, batch_id)
             values ($1, $2, $3, $4) on conflict (event_id) do nothing`,
            [event.event_id, deviceId, event.event_type, batchId]
        );
        if (rowCount === 0) {
            await client.query('rollback');
            return { event_id: event.event_id, status: 'duplicate' };
        }
        await apply(client, event);
        await client.query('commit');
        return { event_id: event.event_id, status: 'inserted' };
    } catch (error) {
        await client.query('rollback');
        const code = (error as { code?: string }).code;
        if (code?.startsWith('23')) {
            const constraint = (error as { constraint?: string }).constraint;
            return { event_id: event.event_id, status: 'rejected', reason: `Restricción de la BD: ${constraint ?? code}` };
        }
        throw error;
    }
}

export async function syncBatch(deviceId: string, batchId: string, events: { event_id: string; event_type?: unknown }[]) {
    const results: EventResult[] = [];
    const client = await pool.connect();
    try {
        for (const raw of events) {
            const event = parse(raw, deviceId);
            results.push(
                typeof event === 'string'
                    ? { event_id: raw.event_id, status: 'rejected', reason: event }
                    : await applyEvent(client, deviceId, batchId, event)
            );
        }
    } finally {
        client.release();
    }
    const count = (status: EventResult['status']) => results.filter((r) => r.status === status).length;
    return { batch_id: batchId, results, inserted: count('inserted'), duplicated: count('duplicate'), rejected: count('rejected') };
}
