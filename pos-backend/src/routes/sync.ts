import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { HttpError } from "../http/errors.js";

export const syncRouter = Router();

// Forma del evento definida en SPEC-001 (igual al payload de event_log en la app).
// Validación mínima de forma. La validación completa y los lotes son de SPEC-008.
const saleCreatedEventSchema = z.object({
    event_id: z.uuid(),
    event_type: z.literal('sale_created'),
    device_id: z.string(),
    created_at: z.iso.datetime({ offset: true }),
    payload: z.object({
        sale: z.object({
            id: z.uuid(),
            device_id: z.string(),
            total_cents: z.number().int(),
            payment_method: z.string(),
            created_at: z.iso.datetime({ offset: true }),
            session_id: z.uuid().nullable().optional(),
        }),
        items: z.array(z.object({
            id: z.uuid(),
            sale_id: z.uuid(),
            product_id: z.uuid(),
            quantity: z.number().int(),
            unit_price_cents: z.number().int(),
        })).min(1),
    }),
}).refine((e) => e.payload.sale.id === e.event_id, { message: 'sale.id debe ser igual a event_id', path: ['payload', 'sale', 'id'] })
  .refine((e) => e.payload.items.every((item) => item.sale_id === e.event_id), { message: 'items[].sale_id debe ser igual a event_id', path: ['payload', 'items'] });

const syncBatchSchema = z.object({ events: z.array(saleCreatedEventSchema) });

syncRouter.post('/events', async (req, res) => {
    const { events } = syncBatchSchema.parse(req.body);
    // SPEC-003 RF-6: un dispositivo solo envía sus propios eventos.
    const deviceId = res.locals.deviceId as string;
    if (events.some((e) => e.device_id !== deviceId || e.payload.sale.device_id !== deviceId)) {
        throw new HttpError(403, 'FORBIDDEN', 'El evento pertenece a otro dispositivo');
    }

    let inserted = 0;
    let duplicated = 0;

    const client = await pool.connect();
    try {
        for (const event of events) {
            const { sale, items } = event.payload;
            await client.query('begin');
            try {
                const result = await client.query(
                    `insert into sales (id, device_id, total_cents, payment_method, created_at, session_id)
                    values ($1, $2, $3, $4, $5, $6) on conflict (id) do nothing`,
                    [sale.id, sale.device_id, sale.total_cents, sale.payment_method, sale.created_at, sale.session_id ?? null]
                );

                if (result.rowCount === 1) {
                    for (const item of items) {
                        await client.query(
                            `insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents)
                            values ($1, $2, $3, $4, $5)`,
                            [item.id, item.sale_id, item.product_id, item.quantity, item.unit_price_cents]
                        );
                    }
                    inserted++;
                } else {
                    duplicated++;
                }
                await client.query('commit');
            } catch (error) {
                await client.query('rollback');
                throw error;
            }
        }
    } finally {
        client.release();
    }

    res.json({
        received: events.length,
        inserted,
        duplicated
    });
});
