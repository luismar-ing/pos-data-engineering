import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../../../core/db/database';
import { getDeviceIdentity } from '../../../core/device/deviceIdentity';
import { computeTotalCents, validateSaleLines, type SaleLineInput } from '../domain/saleTotals';

export interface Sale {
  id: string;
  device_id: string;
  total_cents: number;
  payment_method: string;
  created_at: string;
  /** Nulo solo en ventas anteriores a SPEC-003. */
  session_id: string | null;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
}

/** Payload del evento `sale_created`: la venta completa, tal como la recibe el backend. */
export interface SaleCreatedPayload {
  sale: Sale;
  items: SaleItem[];
}

export class NoOpenSessionError extends Error {
  constructor() {
    super('Abre una sesión antes de cobrar');
  }
}

export interface CreateSaleInput {
  paymentMethod: string;
  lines: SaleLineInput[];
}

/**
 * Registra una venta de forma atómica: cabecera + líneas + evento `sale_created` en la bitácora.
 * El id del evento es el mismo que el de la venta, así el backend puede deduplicar por él.
 * Toma el dispositivo y la sesión abierta; sin sesión lanza `NoOpenSessionError` (SPEC-003 RF-8, RF-11).
 */
export async function createSale(input: CreateSaleInput): Promise<SaleCreatedPayload> {
  validateSaleLines(input.lines);
  const { id: deviceId } = await getDeviceIdentity();

  const sale: Sale = {
    id: randomUUID(),
    device_id: deviceId,
    total_cents: computeTotalCents(input.lines),
    payment_method: input.paymentMethod,
    created_at: new Date().toISOString(),
    session_id: null,
  };
  const items: SaleItem[] = input.lines.map((line) => ({
    id: randomUUID(),
    sale_id: sale.id,
    product_id: line.productId,
    quantity: line.quantity,
    unit_price_cents: line.unitPriceCents,
  }));
  const payload: SaleCreatedPayload = { sale, items };

  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // La sesión se lee dentro de la transacción: no puede cerrarse entre la lectura y la venta.
    const session = await txn.getFirstAsync<{ id: string }>('select id from sessions where closed_at is null');
    if (!session) throw new NoOpenSessionError();
    sale.session_id = session.id;

    await txn.runAsync(
      'insert into sales (id, device_id, total_cents, payment_method, created_at, session_id) values (?, ?, ?, ?, ?, ?)',
      [sale.id, sale.device_id, sale.total_cents, sale.payment_method, sale.created_at, sale.session_id]
    );
    for (const item of items) {
      await txn.runAsync(
        'insert into sale_items (id, sale_id, product_id, quantity, unit_price_cents) values (?, ?, ?, ?, ?)',
        [item.id, item.sale_id, item.product_id, item.quantity, item.unit_price_cents]
      );
    }
    await txn.runAsync(
      `insert into event_log (id, event_type, entity_type, entity_id, payload_json, created_at)
       values (?, 'sale_created', 'sale', ?, ?, ?)`,
      [sale.id, sale.id, JSON.stringify(payload), sale.created_at]
    );
  });

  return payload;
}
