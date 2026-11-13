// SPEC-013: rutas del panel de administración (contratos en ARCHITECTURE.md §5).
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../http/auth.js';
import { HttpError } from '../http/errors.js';
import { login, logout, PASSWORD_MAX } from '../services/adminAuthService.js';
import { salesSummary } from '../services/adminSalesService.js';
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
    const rows = await stockReport(pool);
    res.json({
        generated_at: new Date().toISOString(),
        products: rows.map(({ id, ...row }) => ({ product_id: id, ...row })),
    });
});
