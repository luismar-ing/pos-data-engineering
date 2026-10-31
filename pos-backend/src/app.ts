import express from 'express';
import { prestamosRouter } from './routes/prestamos.js';
import { syncRouter } from './routes/sync.js';
import { catalogoRouter } from './routes/catalogo.js';
import { healthRouter } from './routes/health.js';
import { devicesRouter } from './routes/devices.js';
import { requireDevice } from './http/auth.js';
import { errorHandler, notFound } from './http/errors.js';

export function createApp() {
    const app = express();
    app.use(express.json());

    app.use('/health', healthRouter);
    app.use('/devices', devicesRouter);
    app.use('/prestamos', requireDevice, prestamosRouter);
    app.use('/sync', requireDevice, syncRouter);
    app.use('/catalogo', catalogoRouter);

    app.use(notFound);
    app.use(errorHandler);
    return app;
}
