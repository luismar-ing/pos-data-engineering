import { Router } from 'express';
import { z } from 'zod';
import { calculateLeaseQty } from '../services/rollingAverage.js';

export const prestamosRouter = Router();

const leaseRequestSchema = z.object({ product_id: z.uuid() });

prestamosRouter.post('/request', async (req, res) => {
    const { product_id } = leaseRequestSchema.parse(req.body);

    const qty = await calculateLeaseQty(product_id);
    res.json({
        product_id,
        qty_total: qty,
        created_at: new Date().toISOString()
    });
})

