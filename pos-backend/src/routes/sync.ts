import { Router } from "express";
import { pool } from "../db/pool.js";

export const syncRouter = Router();

// Forma del evento definida en SPEC-001 (igual al payload de event_log en la app).
interface SaleItemPayload {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    unit_price_cents: number;
}

interface SaleCreatedEvent {
    event_id: string;
    event_type: 'sale_created';
    device_id: string;
    created_at: string;
    payload: {
        sale: {
            id: string;
            device_id: string;
            total_cents: number;
            payment_method: string;
            created_at: string;
        };
        items: SaleItemPayload[];
    };
}

// Validación mínima de forma. La validación completa y los lotes son de SPEC-008.
function isSaleCreatedEvent(value: unknown): value is SaleCreatedEvent {
    const e = value as SaleCreatedEvent | null;
    return (
        typeof e === 'object' && e !== null &&
        e.event_type === 'sale_created' &&
        typeof e.event_id === 'string' &&
        typeof e.payload?.sale === 'object' && e.payload.sale !== null &&
        e.payload.sale.id === e.event_id &&
        Array.isArray(e.payload.items) && e.payload.items.length > 0 &&
        e.payload.items.every((item) => item?.sale_id === e.event_id)
    );
}

syncRouter.post('/events', async (req, res) => {
    const events: unknown = req.body?.events;
    if (!Array.isArray(events)) {
        return res.status(400).json({ error: 'events debe ser un arreglo' });
    }
    const invalid = events.findIndex((event) => !isSaleCreatedEvent(event));
    if (invalid !== -1) {
        return res.status(400).json({ error: `evento inválido en la posición ${invalid}` });
    }

    let inserted = 0;
    let duplicated = 0;

    const client = await pool.connect();
    try {
        for (const event of events as SaleCreatedEvent[]) {
            const { sale, items } = event.payload;
            await client.query('begin');
            try {
                const result = await client.query(
                    `insert into sales (id, device_id, total_cents, payment_method, created_at)
                    values ($1, $2, $3, $4, $5) on conflict (id) do nothing`,
                    [sale.id, sale.device_id, sale.total_cents, sale.payment_method, sale.created_at]
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
