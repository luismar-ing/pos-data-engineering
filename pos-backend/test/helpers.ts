import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { migrate, seed } from '../src/db/migrate.js';

export { pool };

export async function resetDb(): Promise<void> {
    await migrate(pool);
    await pool.query('truncate sale_items, sales, stock_leases, products, devices cascade');
    await seed(pool);
}

export async function startServer(): Promise<{ url: string; close: () => Promise<void> }> {
    const server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve) => server.close(() => resolve())),
    };
}

export function postJson(url: string, body: unknown, secret?: string): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

/** Registra un dispositivo nuevo por la API y devuelve su id y secreto. */
export async function registerDevice(url: string): Promise<{ deviceId: string; secret: string }> {
    const deviceId = randomUUID();
    const secret = randomBytes(32).toString('hex');
    const res = await postJson(`${url}/devices/register`, { device_id: deviceId, name: 'Prueba', secret });
    if (res.status !== 201) throw new Error(`registro falló: ${res.status}`);
    return { deviceId, secret };
}
