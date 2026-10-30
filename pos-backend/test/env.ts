// Se carga con --import antes de cada archivo de prueba: apunta la app a la BD de pruebas.
import 'dotenv/config';

if (!process.env.TEST_DB_URL) throw new Error('Falta TEST_DB_URL en .env (ver .env.example)');
// Las pruebas truncan tablas: nunca contra una BD que no sea de pruebas.
if (!new URL(process.env.TEST_DB_URL).pathname.endsWith('_test')) throw new Error('TEST_DB_URL debe apuntar a una BD cuyo nombre termine en _test');
process.env.DB_URL = process.env.TEST_DB_URL;
