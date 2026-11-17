// SPEC-014 RF-18, RNF-2: registro de cambios del panel e idempotencia por request_id.
import type { Pool, PoolClient } from 'pg';

export type AuditAction = 'device_revoke' | 'device_reactivate' | 'product_create' | 'product_update' | 'stock_adjust';

export interface Change<T> {
    entityId: string;
    before: T | null;
    after: T;
}

async function stored<T>(db: Pool | PoolClient, requestId: string): Promise<T | undefined> {
    const { rows } = await db.query<{ after: T }>('select after from admin_audit where request_id = $1', [requestId]);
    return rows[0]?.after;
}

/**
 * Aplica `change` y su fila de registro en una sola transacción. Si el `request_id` ya existe, devuelve lo guardado
 * sin aplicar nada: un reintento por red no cambia dos veces (también si el cuerpo cambió).
 */
export async function withAudit<T>(
    pool: Pool,
    adminId: string,
    requestId: string,
    action: AuditAction,
    change: (client: PoolClient) => Promise<Change<T>>
): Promise<{ result: T; repeated: boolean }> {
    const client = await pool.connect();
    try {
        await client.query('begin');
        const previous = await stored<T>(client, requestId);
        if (previous !== undefined) {
            await client.query('rollback');
            return { result: previous, repeated: true };
        }
        const { entityId, before, after } = await change(client);
        await client.query(
            `insert into admin_audit (request_id, admin_id, action, entity_id, before, after) values ($1, $2, $3, $4, $5, $6)`,
            [requestId, adminId, action, entityId, before === null ? null : JSON.stringify(before), JSON.stringify(after)]
        );
        await client.query('commit');
        // Lo mismo que devolverá una repetición: JSON ida y vuelta (fechas como texto ISO).
        return { result: JSON.parse(JSON.stringify(after)) as T, repeated: false };
    } catch (error) {
        await client.query('rollback');
        // El mismo request_id a la vez: el otro ganó y esta transacción se deshizo; se devuelve lo suyo.
        if ((error as { constraint?: string }).constraint === 'admin_audit_pkey') {
            const previous = await stored<T>(pool, requestId);
            if (previous !== undefined) return { result: previous, repeated: true };
        }
        throw error;
    } finally {
        client.release();
    }
}

export interface AuditEntry {
    request_id: string;
    username: string;
    action: AuditAction;
    entity_id: string;
    before: unknown;
    after: unknown;
    created_at: Date;
}

/** Lo más reciente primero; `before` pagina hacia atrás por `created_at`. */
export async function listAudit(pool: Pool, limit: number, before?: Date): Promise<AuditEntry[]> {
    const { rows } = await pool.query<AuditEntry>(
        `select a.request_id, ad.username, a.action, a.entity_id, a.before, a.after, a.created_at
         from admin_audit a join admins ad on ad.id = a.admin_id
         where $2::timestamptz is null or a.created_at < $2
         order by a.created_at desc
         limit $1`,
        [limit, before ?? null]
    );
    return rows;
}
