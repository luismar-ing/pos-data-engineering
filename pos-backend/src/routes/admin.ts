// SPEC-013: rutas del panel de administración (contratos en ARCHITECTURE.md §5).
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../http/auth.js';
import { HttpError } from '../http/errors.js';
import { listAudit, withAudit } from '../services/adminAuditService.js';
import { login, logout, PASSWORD_MAX } from '../services/adminAuthService.js';
import { adjustStock, createProduct, updateProduct } from '../services/adminCatalogService.js';
import { listDevices, setRevoked } from '../services/adminDevicesService.js';
import { reconciliation } from '../services/adminReconciliationService.js';
import { salesSummary } from '../services/adminSalesService.js';
import { releaseRevokedLeases } from '../services/leaseService.js';
import { stockReport } from '../services/stockService.js';

export const adminRouter = Router();

const MAX_RANGE_MS = 31 * 24 * 3_600_000;

const salesQuery = z
    .object({ from: z.iso.datetime({ offset: true }), to: z.iso.datetime({ offset: true }) })
    .transform(({ from, to }) => ({ from: new Date(from), to: new Date(to) }))
    .refine(({ from, to }) => from <= to, { message: 'from no puede ser posterior a to', path: ['from'] })
    .refine(({ from, to }) => to.getTime() - from.getTime() <= MAX_RANGE_MS, { message: 'El rango no puede pasar de 31 días', path: ['to'] });

const loginSchema = z.object({
    username: z.string().min(3).max(40),
    password: z.string().min(1).max(PASSWORD_MAX),
});

// shortcut: bloqueo solo por usuario, sin rate limit por IP (ADR-0007); añadirlo antes de exponer el backend fuera de la red local.
adminRouter.post('/login', async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const session = await login(pool, username, password);
    if (!session) {
        // RF-6: el mismo error para usuario inexistente, contraseña incorrecta y usuario bloqueado.
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos. Tras 5 intentos fallidos el usuario se bloquea 15 minutos');
    }
    res.json(session);
});

// Todo lo que sigue exige una sesión de administrador vigente.
adminRouter.use(requireAdmin);

adminRouter.post('/logout', async (_req, res) => {
    await logout(pool, res.locals.tokenHash);
    res.status(204).end();
});

// RF-10..RF-12: ventas de todos los dispositivos en [from, to).
adminRouter.get('/sales', async (req, res) => {
    const { from, to } = salesQuery.parse(req.query);
    res.json(await salesSummary(pool, from, to));
});

// RF-13, RF-14: mismo cálculo que `npm run report:stock`.
adminRouter.get('/stock', async (_req, res) => {
    await releaseRevokedLeases(pool); // SPEC-014: que el panel no muestre una devolución atrasada
    const rows = await stockReport(pool);
    res.json({
        generated_at: new Date().toISOString(),
        products: rows.map(({ id, ...row }) => ({ product_id: id, ...row })),
    });
});

// SPEC-014: dispositivos, conciliación, catálogo y registro de cambios.

const requestId = z.object({ request_id: z.uuid() });
const productId = z.object({ id: z.uuid() });
const name = z.string().trim().min(1).max(100);
const category = z.string().trim().min(1).max(50);
const price = z.number().int().min(0).max(100_000_000);

const createProductSchema = requestId.extend({
    name,
    category: category.optional(),
    unit_price_cents: price,
    initial_stock: z.number().int().min(0).max(1_000_000),
});
const patchProductSchema = requestId
    .extend({ name: name.optional(), category: category.nullable().optional(), unit_price_cents: price.optional(), active: z.boolean().optional() })
    .refine(({ request_id: _, ...patch }) => Object.values(patch).some((v) => v !== undefined), { message: 'Nada que cambiar' });
const stockSchema = requestId.extend({ delta: z.number().int().min(-1_000_000).max(1_000_000).refine((d) => d !== 0, { message: 'delta no puede ser 0' }) });
const auditQuery = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    before: z.iso.datetime({ offset: true }).transform((v) => new Date(v)).optional(),
});

// RF-1
adminRouter.get('/devices', async (_req, res) => {
    await releaseRevokedLeases(pool);
    res.json({ generated_at: new Date().toISOString(), devices: await listDevices(pool) });
});

// RF-2, RF-7
for (const [path, revoked] of [['revoke', true], ['reactivate', false]] as const) {
    adminRouter.post(`/devices/:id/${path}`, async (req, res) => {
        const { request_id } = requestId.parse(req.body);
        const action = revoked ? 'device_revoke' : 'device_reactivate';
        const { result } = await withAudit(pool, res.locals.adminId, request_id, action, (client) => setRevoked(client, req.params.id, revoked));
        res.json({ device: result });
    });
}

// RF-10..RF-12
adminRouter.get('/reconciliation', async (req, res) => {
    const { from, to } = salesQuery.parse(req.query);
    await releaseRevokedLeases(pool);
    res.json(await reconciliation(pool, from, to));
});

// RF-13
adminRouter.post('/products', async (req, res) => {
    const { request_id, ...input } = createProductSchema.parse(req.body);
    const { result } = await withAudit(pool, res.locals.adminId, request_id, 'product_create', (client) => createProduct(client, input));
    res.status(201).json({ product: result });
});

// RF-14, RF-16
adminRouter.patch('/products/:id', async (req, res) => {
    const { id } = productId.parse(req.params);
    const { request_id, ...patch } = patchProductSchema.parse(req.body);
    const { result } = await withAudit(pool, res.locals.adminId, request_id, 'product_update', (client) => updateProduct(client, id, patch));
    res.json({ product: result });
});

// RF-15, RF-17
adminRouter.post('/products/:id/stock', async (req, res) => {
    const { id } = productId.parse(req.params);
    const { request_id, delta } = stockSchema.parse(req.body);
    const { result } = await withAudit(pool, res.locals.adminId, request_id, 'stock_adjust', (client) => adjustStock(client, id, delta));
    res.json({ product: result });
});

// RF-18
adminRouter.get('/audit', async (req, res) => {
    const { limit, before } = auditQuery.parse(req.query);
    res.json({ entries: await listAudit(pool, limit, before) });
});
