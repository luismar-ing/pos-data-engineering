import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pool } from '../db/pool.js';
import { HttpError } from './errors.js';

// El secreto tiene 256 bits aleatorios: SHA-256 basta y buscar por hash no revela nada por tiempo (SPEC-003 RNF-3).
export function hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
}

/** Exige `Authorization: Bearer <secreto>` de un dispositivo registrado; deja `res.locals.deviceId`. */
export const requireDevice: RequestHandler = async (req, res, next) => {
    const secret = req.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!secret) throw new HttpError(401, 'UNAUTHORIZED', 'Falta la credencial del dispositivo');

    const { rows } = await pool.query<{ id: string }>('select id from devices where token_hash = $1', [hashSecret(secret)]);
    if (!rows[0]) throw new HttpError(401, 'UNAUTHORIZED', 'Credencial de dispositivo inválida');

    res.locals.deviceId = rows[0].id;
    next();
};
