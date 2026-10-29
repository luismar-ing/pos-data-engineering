import { Router } from "express";
import { pool } from "../db/pool.js";

export const syncRouter = Router();

interface ProximoEvento {
    event_id: string;
    device_id: string;
    product_id: string;
    quantity: number;
    created_at: string;
}

syncRouter.post('/events', async (req, res) => {
    const events: ProximoEvento[] = req.body.events;

    let insertado = 0;
    let duplicado = 0;

    for (const event of events) {
        const result = await pool.query(
            `insert into sale_events (event_id, device_id, product_id, quantity, created_at)
            values ($1, $2, $3, $4, $5) on conflict (event_id) do nothing`,
            [event.event_id, event.device_id, event.product_id, event.quantity, event.created_at]
        );

        if (result.rowCount === 1) {
            insertado++;
        } else {
            duplicado++;
        }
    }

    res.json({
        received: events.length,
        insertado,
        duplicado

    })
})