// Uso: tsx src/db/cli.ts migrate|seed
import { pool } from './pool.js';
import { migrate, seed } from './migrate.js';

const command = process.argv[2];
const run = command === 'migrate' ? migrate : command === 'seed' ? seed : null;

if (!run) {
    console.error('Uso: tsx src/db/cli.ts migrate|seed');
    process.exit(1);
}

try {
    await run(pool);
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
} finally {
    await pool.end();
}
