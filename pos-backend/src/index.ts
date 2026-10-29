import express from 'express';
import { prestamosRouter } from './routes/prestamos.js';
import { syncRouter } from './routes/sync.js';
import { catalogoRouter } from './routes/catalogo.js';

const app = express();
app.use(express.json());

app.use('/prestamos', prestamosRouter);
app.use('/sync', syncRouter);
app.use('/catalogo', catalogoRouter);

const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));