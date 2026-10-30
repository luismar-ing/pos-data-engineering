import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

// Forma única de error (SPEC-002 RF-6): { error: { code, message, details? } }
export class HttpError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

export const notFound: RequestHandler = (req, _res, next) => {
    next(new HttpError(404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }
    if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Datos de entrada inválidos', details } });
    }
    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo no es JSON válido' } });
    }
    // Otros errores de body-parser (413 cuerpo demasiado grande, 415 codificación no soportada).
    if (err?.expose && err.status >= 400 && err.status < 500) {
        const code = err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
        return res.status(err.status).json({ error: { code, message: 'Petición no válida' } });
    }
    console.error(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
};
