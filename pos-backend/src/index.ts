import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { releaseRevokedLeases } from './services/leaseService.js';

createApp().listen(config.port, () => console.log(`Backend corriendo en puerto ${config.port}`));

// SPEC-014 RF-5 (ADR-0008): devuelve la cuota de dispositivos dados de baja cuando pasa su plazo.
// shortcut: un setInterval por proceso; con varios servidores sigue siendo correcto (for update) pero repite trabajo.
setInterval(() => {
    releaseRevokedLeases(pool)
        .then((n) => n > 0 && console.log(`Préstamos devueltos por baja: ${n}`))
        .catch((error) => console.error('releaseRevokedLeases falló:', error));
}, 60_000);
