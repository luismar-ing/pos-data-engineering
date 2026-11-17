// SPEC-014 RF-1, RF-2, RF-7: dispositivos, baja y reactivación.
import type { Pool, PoolClient } from 'pg';
import { HttpError } from '../http/errors.js';
import type { Change } from './adminAuditService.js';
import { REVOKE_RELEASE_MINUTES } from './leaseService.js';

export interface Device {
    id: string;
    name: string | null;
    revoked_at: Date | null;
    last_seen_at: Date | null;
}

const DEVICE_COLUMNS = 'id, name, revoked_at, last_seen_at';

/** Todos los dispositivos con último contacto, última sync, sesión abierta y préstamos activos. Una consulta. */
export async function listDevices(pool: Pool) {
    const { rows } = await pool.query(
        `select d.id, d.name, d.revoked_at, d.last_seen_at,
                (select max(e.received_at) from sync_events e where e.device_id = d.id) as last_sync_at,
                (select json_build_object('seller_name', s.seller_name, 'opened_at', s.opened_at)
                   from sessions s
                  where s.device_id = d.id and s.closed_at is null and s.opened_at is not null
                  order by s.opened_at desc limit 1) as open_session,
                coalesce((select json_agg(json_build_object(
                            'id', l.id, 'product_id', l.product_id, 'product_name', p.name,
                            'quota_total', l.quota_total, 'quota_used', l.quota_used, 'expires_at', l.expires_at,
                            'release_at', case when d.revoked_at is not null
                                               then l.expires_at + make_interval(mins => $1) end)
                            order by p.name)
                   from stock_leases l join products p on p.id = l.product_id
                  where l.device_id = d.id and l.status = 'active'), '[]'::json) as leases
         from devices d
         order by d.revoked_at is not null, d.name nulls last, d.id`,
        [REVOKE_RELEASE_MINUTES]
    );
    return rows;
}

/**
 * Baja (`revoked = true`) o reactivación. Repetir la misma acción no cambia nada: la baja conserva su hora original.
 * El `for update` hace esperar a un pedido de préstamo en curso del mismo dispositivo (ver `requestLeases`).
 */
export async function setRevoked(client: PoolClient, deviceId: string, revoked: boolean): Promise<Change<Device>> {
    const { rows: [before] } = await client.query<Device>(`select ${DEVICE_COLUMNS} from devices where id = $1 for update`, [deviceId]);
    if (!before) throw new HttpError(404, 'DEVICE_NOT_FOUND', 'El dispositivo no existe');
    const { rows: [after] } = await client.query<Device>(
        `update devices set revoked_at = case when $2 then coalesce(revoked_at, now()) end where id = $1 returning ${DEVICE_COLUMNS}`,
        [deviceId, revoked]
    );
    return { entityId: deviceId, before, after: after! };
}
