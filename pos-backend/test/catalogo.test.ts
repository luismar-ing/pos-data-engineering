import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { pool, resetDb, startServer } from './helpers.js';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { await resetDb(); server = await startServer(); });
after(async () => { await server.close(); await pool.end(); });

test('GET /catalogo es público, solo activos y ordenado por nombre (CA-7)', async () => {
    await pool.query(`update products set active = false where name = 'Hot dog'`);

    const res = await fetch(`${server.url}/catalogo`);
    assert.equal(res.status, 200);
    const products = (await res.json()) as { name: string; unit_price_cents: number; active: boolean }[];

    const names = products.map((p) => p.name);
    assert.deepEqual(names, ['Agua 600 ml', 'Cerveza 355 ml', 'Papas fritas', 'Refresco 355 ml']);
    assert.ok(products.every((p) => p.active === true && Number.isInteger(p.unit_price_cents)));
});
