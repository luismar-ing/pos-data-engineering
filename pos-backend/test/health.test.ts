import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { pool, startServer } from './helpers.js';

let server: Awaited<ReturnType<typeof startServer>>;
before(async () => { server = await startServer(); });
after(async () => { await server.close(); await pool.end(); });

// El caso "BD caída → 503" se verifica a mano deteniendo el contenedor (CA-5).
test('GET /health con BD arriba → 200', async () => {
    const res = await fetch(`${server.url}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok', db: 'up' });
});
