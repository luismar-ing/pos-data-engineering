// SPEC-013 / ADR-0007: contraseñas y cuentas de administrador.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { Pool } from 'pg';
import { hashSecret } from '../http/auth.js';

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** RF-7, RF-8: bloqueo tras 5 fallos seguidos durante 15 min; sesión de 8 h. */
export const LOGIN_POLICY = { maxAttempts: 5, lockMinutes: 15, sessionHours: 8 } as const;

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

function scryptAsync(password: string, salt: Buffer, options: ScryptOptions, keyLength = KEY_LENGTH): Promise<Buffer> {
    return new Promise((resolve, reject) =>
        scrypt(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key)))
    );
}

/** `scrypt$N$r$p$<sal hex>$<hash hex>`: guarda los parámetros para poder subir el costo sin migrar (ADR-0007). */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await scryptAsync(password, salt, SCRYPT);
    return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('hex'), key.toString('hex')].join('$');
}

/** Compara en tiempo constante; un hash mal formado nunca coincide. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, saltHex, keyHex, ...rest] = stored.split('$');
    if (scheme !== 'scrypt' || rest.length > 0 || !saltHex || !keyHex) return false;
    const options = { N: Number(n), r: Number(r), p: Number(p) };
    if (![options.N, options.r, options.p].every((v) => Number.isInteger(v) && v > 0)) return false;
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length === 0) return false;
    // maxmem por encima de 128·N·r, el mínimo que exige scrypt para esos parámetros.
    const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), { ...options, maxmem: 256 * options.N * options.r }, expected.length);
    return timingSafeEqual(key, expected);
}

/** Valida lo que se va a guardar; lanza con un mensaje para el comando `admin:set`. */
export function validateAdminInput(username: string, password: string | undefined): asserts password is string {
    if (!USERNAME_PATTERN.test(username)) {
        throw new Error('El usuario debe tener de 3 a 40 caracteres: minúsculas, números, punto, guion o guion bajo');
    }
    if (!password || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
        throw new Error(`La contraseña (ADMIN_PASSWORD) debe tener de ${PASSWORD_MIN} a ${PASSWORD_MAX} caracteres`);
    }
}

/**
 * Crea el administrador o le cambia la contraseña (SPEC-013 RF-9).
 * Al cambiarla quita el bloqueo y cierra todas sus sesiones (ADR-0007, punto 6).
 */
export async function setAdmin(pool: Pool, username: string, password: string | undefined): Promise<{ created: boolean }> {
    validateAdminInput(username, password);
    const passwordHash = await hashPassword(password);
    const client = await pool.connect();
    try {
        await client.query('begin');
        const { rows: [admin] } = await client.query<{ id: string; created: boolean }>(
            `insert into admins (username, password_hash) values ($1, $2)
             on conflict (username) do update set password_hash = excluded.password_hash, failed_attempts = 0, locked_until = null
             returning id, (xmax = 0) as created`,
            [username, passwordHash]
        );
        await client.query('delete from admin_sessions where admin_id = $1', [admin!.id]);
        await client.query('commit');
        return { created: admin!.created };
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}

export interface AdminLogin {
    token: string;
    username: string;
    expires_at: string;
}

// Hash de relleno: con un usuario inexistente se calcula igual un scrypt, así el tiempo no revela qué usuarios existen.
let dummyHash: Promise<string> | undefined;

/**
 * Login de administrador (RF-5..RF-8). `null` = credenciales inválidas, sin decir por qué (RF-6):
 * usuario inexistente, contraseña incorrecta o usuario bloqueado.
 * La fila del administrador queda bloqueada (`for update`) para que intentos simultáneos no se salten la cuenta (RF-7).
 */
export async function login(pool: Pool, username: string, password: string): Promise<AdminLogin | null> {
    const client = await pool.connect();
    try {
        await client.query('begin');
        const { rows: [admin] } = await client.query<{ id: string; password_hash: string; failed_attempts: number; locked: boolean }>(
            `select id, password_hash, failed_attempts, coalesce(locked_until > now(), false) as locked
             from admins where username = $1 for update`,
            [username]
        );
        const valid = await verifyPassword(password, admin?.password_hash ?? (await (dummyHash ??= hashPassword(randomBytes(16).toString('hex')))));

        let result: AdminLogin | null = null;
        if (admin && !admin.locked) {
            if (valid) {
                const token = randomBytes(32).toString('hex');
                const { rows: [session] } = await client.query<{ expires_at: Date }>(
                    `insert into admin_sessions (token_hash, admin_id, expires_at)
                     values ($1, $2, now() + make_interval(hours => $3)) returning expires_at`,
                    [hashSecret(token), admin.id, LOGIN_POLICY.sessionHours]
                );
                await client.query('update admins set failed_attempts = 0, locked_until = null where id = $1', [admin.id]);
                result = { token, username, expires_at: session!.expires_at.toISOString() };
            } else if (admin.failed_attempts + 1 >= LOGIN_POLICY.maxAttempts) {
                await client.query(
                    `update admins set failed_attempts = 0, locked_until = now() + make_interval(mins => $2) where id = $1`,
                    [admin.id, LOGIN_POLICY.lockMinutes]
                );
            } else {
                await client.query('update admins set failed_attempts = failed_attempts + 1 where id = $1', [admin.id]);
            }
        }
        await client.query('commit'); // también en los fallos: el contador tiene que quedar guardado
        return result;
    } catch (error) {
        await client.query('rollback');
        throw error;
    } finally {
        client.release();
    }
}

/** Cierra la sesión del token; repetirlo no hace nada (la ruta ya responde 401 por `requireAdmin`). */
export async function logout(pool: Pool, tokenHash: string): Promise<void> {
    await pool.query('delete from admin_sessions where token_hash = $1', [tokenHash]);
}
