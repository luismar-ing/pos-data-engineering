import { Router } from 'express';
import { pool } from '../db/pool.js';
import { HttpError } from '../http/errors.js';

export const healthRouter = Router();

const DB_TIMEOUT_MS = 800;

healthRouter.get('/', async (_req, res) => {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS);
    });
    try {
        await Promise.race([pool.query('select 1'), timeout]);
    } catch {
        throw new HttpError(503, 'DB_UNAVAILABLE', 'La base de datos no responde');
    } finally {
        clearTimeout(timer);
    }
    res.json({ status: 'ok', db: 'up' });
});
