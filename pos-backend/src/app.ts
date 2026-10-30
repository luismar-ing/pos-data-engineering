import express from 'express';
import { prestamosRouter } from './routes/prestamos.js';
import { syncRouter } from './routes/sync.js';
import { catalogoRouter } from './routes/catalogo.js';
import { healthRouter } from './routes/health.js';
import { errorHandler, notFound } from './http/errors.js';

export function createApp() {
    const app = express();
    app.use(express.json());

    app.use('/health', healthRouter);
    app.use('/prestamos', prestamosRouter);
    app.use('/sync', syncRouter);
    app.use('/catalogo', catalogoRouter);

    app.use(notFound);
    app.use(errorHandler);
    return app;
}
