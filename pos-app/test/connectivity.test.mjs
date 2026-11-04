// SPEC-006: estado de conexión.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATALOG_STALE_MS,
  createConnectivity,
  isCatalogStale,
  probeServer,
} from '../src/core/network/connectivity.ts';

const API = 'http://server';

test('probeServer: 200 en línea; 503 y error de red sin conexión (RF-1, P5)', async () => {
  const calls = [];
  assert.equal(await probeServer(API, async (url) => (calls.push(url), { status: 200 })), true);
  assert.deepEqual(calls, ['http://server/health']);
  assert.equal(await probeServer(API, async () => ({ status: 503 })), false);
  assert.equal(await probeServer(API, async () => { throw new TypeError('Network request failed'); }), false);
});

test('probeServer: sin respuesta a tiempo cuenta como sin conexión (RNF-3)', async () => {
  const hang = (_url, { signal }) =>
    new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  assert.equal(await probeServer(API, hang, 10), false);
});

test('probeServer: sin URL no hace petición (RF-5)', async () => {
  let called = false;
  assert.equal(await probeServer(undefined, async () => ((called = true), { status: 200 })), false);
  assert.equal(called, false);
});

function setup() {
  const timers = { active: new Set(), set(fn) { const id = {}; this.active.add(id); return id; }, clear(id) { this.active.delete(id); } };
  let probes = 0;
  const states = [];
  const c = createConnectivity({
    probe: async () => (probes++, true),
    setOnline: (v) => states.push(v),
    timers,
  });
  let reconnects = 0;
  c.onReconnect(() => reconnects++);
  return { c, timers, states, probes: () => probes, reconnects: () => reconnects };
}

test('sin conexión reintenta; al volver para y avisa una vez (RF-3, RF-7, RNF-4)', () => {
  const s = setup();
  s.c.handleChange(true, true);
  assert.equal(s.timers.active.size, 0);
  s.c.handleChange(true, false);
  s.c.handleChange(false, false);
  assert.equal(s.timers.active.size, 1);
  s.c.handleChange(false, true);
  assert.equal(s.timers.active.size, 0);
  assert.equal(s.reconnects(), 1);
});

test('tres cortes y vueltas: un aviso por vuelta (RF-8, CA-5)', () => {
  const s = setup();
  for (let i = 0; i < 3; i++) {
    s.c.handleChange(true, false);
    s.c.handleChange(false, true);
  }
  assert.equal(s.reconnects(), 3);
  assert.equal(s.timers.active.size, 0);
});

test('dos comprobaciones seguidas: una sola petición (RF-8)', async () => {
  const s = setup();
  await Promise.all([s.c.check(), s.c.check()]);
  assert.equal(s.probes(), 1);
  assert.deepEqual(s.states, [true]);
  await s.c.check();
  assert.equal(s.probes(), 2);
});

test('quitar un suscriptor deja de avisarle', () => {
  const s = setup();
  let other = 0;
  const off = s.c.onReconnect(() => other++);
  off();
  s.c.handleChange(false, true);
  assert.equal(other, 0);
});

test('isCatalogStale: 5 min (P4)', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');
  assert.equal(isCatalogStale(null, now), true);
  assert.equal(isCatalogStale(new Date(now - 4 * 60_000).toISOString(), now), false);
  assert.equal(isCatalogStale(new Date(now - CATALOG_STALE_MS).toISOString(), now), false);
  assert.equal(isCatalogStale(new Date(now - 6 * 60_000).toISOString(), now), true);
  assert.equal(isCatalogStale('basura', now), true);
});
