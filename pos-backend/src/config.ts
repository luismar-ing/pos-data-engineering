import 'dotenv/config';

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
    console.error('Falta la variable de entorno DB_URL (ver .env.example)');
    process.exit(1);
}

export const config = {
    dbUrl,
    port: Number(process.env.PORT ?? 3000),
};
