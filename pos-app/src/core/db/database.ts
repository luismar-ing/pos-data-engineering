import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (db) return db;

    db = await SQLite.openDatabaseAsync('pos_app.db');
    await db.execAsync(SCHEMA_SQL);
    return db;
}