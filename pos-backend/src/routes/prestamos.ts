import { Router } from 'express';
import { calculateLeaseQty } from '../services/rollingAverage.js';

export const prestamosRouter = Router();

prestamosRouter.post('/request', async (req, res) => {
    const {product_id} = req.body as {product_id: string};
    if (!product_id) {
        return res.status(400).json({error: 'product_id es requerido'});
    }

    const qty = await calculateLeaseQty(product_id);
    res.json({
        product_id,
        qty_total: qty,
        created_at: new Date().toISOString()
    });
})

