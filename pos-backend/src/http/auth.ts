import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pool } from '../db/pool.js';
import { HttpError } from './errors.js';

// El secreto tiene 256 bits aleatorios: SHA-256 basta y buscar por hash no revela nada por tiempo (SPEC-003 RNF-3).
export function hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
}

const bearer = (header: string | undefined) => header?.match(/^Bearer (\S+)$/)?.[1];

/** Exige `Authorization: Bearer <secreto>` de un dispositivo registrado; deja `res.locals.deviceId`. */
export const requireDevice: RequestHandler = async (req, res, next) => {
    const secret = bearer(req.get('authorization'));
    if (!secret) throw new HttpError(401, 'UNAUTHORIZED', 'Falta la credencial del dispositivo');

    // La misma consulta autentica y marca el último contacto (SPEC-013 RF-12).
    const { rows } = await pool.query<{ id: string }>(
        'update devices set last_seen_at = now() where token_hash = $1 returning id',
        [hashSecret(secret)]
    );
    if (!rows[0]) throw new HttpError(401, 'UNAUTHORIZED', 'Credencial de dispositivo inválida');

    res.locals.deviceId = rows[0].id;
    next();
};

/**
 * Exige `Authorization: Bearer <token>` de una sesión de administrador vigente (SPEC-013, ADR-0007).
 * Solo mira `admin_sessions`: un secreto de dispositivo nunca pasa (RNF-2). Deja `res.locals.adminId` y `tokenHash`.
 */
export const requireAdmin: RequestHandler = async (req, res, next) => {
    const token = bearer(req.get('authorization'));
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Falta la sesión de administrador');

    const tokenHash = hashSecret(token);
    const { rows } = await pool.query<{ admin_id: string }>(
        'select admin_id from admin_sessions where token_hash = $1 and expires_at > now()',
        [tokenHash]
    );
    if (!rows[0]) throw new HttpError(401, 'UNAUTHORIZED', 'Sesión de administrador inválida o vencida');

    res.locals.adminId = rows[0].admin_id;
    res.locals.tokenHash = tokenHash;
    next();
};
