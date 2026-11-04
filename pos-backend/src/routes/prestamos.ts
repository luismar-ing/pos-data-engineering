import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { closeLeases, requestLeases } from '../services/leaseService.js';

export const prestamosRouter = Router();

const unique = (ids: string[]) => new Set(ids).size === ids.length;

const requestSchema = z.object({
    product_ids: z.array(z.uuid()).min(1).max(200).refine(unique, { message: 'product_ids repetidos' }),
});

const closeSchema = z.object({
    leases: z
        .array(z.object({ lease_id: z.uuid(), quota_used: z.number().int().min(0) }))
        .min(1)
        .max(200)
        .refine((items) => unique(items.map((item) => item.lease_id)), { message: 'lease_id repetidos' }),
});

/** Toda la petición en una transacción: si un elemento falla, no se aplica nada (SPEC-005 plan §5). */
async function inTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('begin');
        const result = await fn(client);
        await client.query('commit');
        return result;
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}

prestamosRouter.post('/request', async (req, res) => {
    const { product_ids } = requestSchema.parse(req.body);
    const deviceId = res.locals.deviceId as string;
    res.json(await inTransaction((client) => requestLeases(client, deviceId, product_ids)));
});

prestamosRouter.post('/close', async (req, res) => {
    const { leases } = closeSchema.parse(req.body);
    const deviceId = res.locals.deviceId as string;
    res.json(await inTransaction((client) => closeLeases(client, deviceId, leases)));
});
