import { Pool } from 'pg';
import { config } from '../config.js';

// connectionTimeoutMillis: sin BD, las peticiones fallan en vez de quedarse en cola (p. ej. /health repetido).
export const pool = new Pool({ connectionString: config.dbUrl, connectionTimeoutMillis: 2000 });

// Sin esto, una conexión inactiva cortada por Postgres tumba el proceso (TD-020).
pool.on('error', (err) => console.error('pg pool:', err.message));
