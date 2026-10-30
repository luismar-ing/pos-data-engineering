import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../../../core/db/database';
import { computeTotalCents, validateSaleLines, type SaleLineInput } from '../domain/saleTotals';

export interface Sale {
  id: string;
  device_id: string;
  total_cents: number;
  payment_method: string;
  created_at: string;
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

export interface CreateSaleInput {
  deviceId: string;
  paymentMethod: string;
  lines: SaleLineInput[];
}

/**
 * Registra una venta de forma atómica: cabecera + líneas + evento `sale_created` en la bitácora.
 * El id del evento es el mismo que el de la venta, así el backend puede deduplicar por él.
 */
export async function createSale(input: CreateSaleInput): Promise<SaleCreatedPayload> {
  validateSaleLines(input.lines);

  const sale: Sale = {
    id: randomUUID(),
    device_id: input.deviceId,
    total_cents: computeTotalCents(input.lines),
    payment_method: input.paymentMethod,
    created_at: new Date().toISOString(),
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
    await txn.runAsync(
      'insert into sales (id, device_id, total_cents, payment_method, created_at) values (?, ?, ?, ?, ?)',
      [sale.id, sale.device_id, sale.total_cents, sale.payment_method, sale.created_at]
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
