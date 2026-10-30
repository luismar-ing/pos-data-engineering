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

export function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}
