import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { hashSecret } from '../http/auth.js';
import { HttpError } from '../http/errors.js';

export const devicesRouter = Router();

const registerSchema = z.object({
    device_id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    secret: z.string().regex(/^[0-9a-f]{64}$/, 'Debe ser 32 bytes en hexadecimal'),
});

// Idempotente (SPEC-003 RF-3): el mismo id con el mismo secreto es un reintento; con otro secreto, conflicto.
devicesRouter.post('/register', async (req, res) => {
    const { device_id, name, secret } = registerSchema.parse(req.body);
    const tokenHash = hashSecret(secret);

    const inserted = await pool.query(
        `insert into devices (id, name, token_hash) values ($1, $2, $3) on conflict (id) do nothing`,
        [device_id, name, tokenHash]
    );
    if (inserted.rowCount === 1) return res.status(201).json({ device_id, name });

    const updated = await pool.query(
        `update devices set name = $2 where id = $1 and token_hash = $3`,
        [device_id, name, tokenHash]
    );
    if (updated.rowCount !== 1) {
        throw new HttpError(409, 'DEVICE_CONFLICT', 'El dispositivo ya está registrado con otra credencial');
    }
    res.json({ device_id, name });
});
