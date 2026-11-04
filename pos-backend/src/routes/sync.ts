import { Router } from 'express';
import { z } from 'zod';
import { syncBatch } from '../services/syncService.js';

export const syncRouter = Router();

// Solo el sobre: cada evento se valida aparte y, si falla, se rechaza sin tumbar el lote (SPEC-008 RF-8).
const envelopeSchema = z.object({
    batch_id: z.uuid(),
    sent_at: z.iso.datetime({ offset: true }),
    events: z
        .array(z.looseObject({ event_id: z.uuid() }))
        .min(1)
        .max(50)
        .refine((events) => new Set(events.map((e) => e.event_id)).size === events.length, { message: 'event_id repetidos' }),
});

syncRouter.post('/events', async (req, res) => {
    const { batch_id, events } = envelopeSchema.parse(req.body);
    res.json(await syncBatch(res.locals.deviceId as string, batch_id, events));
});
