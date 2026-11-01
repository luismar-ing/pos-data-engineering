import { randomUUID } from 'expo-crypto';
import { getDatabase } from '../../../core/db/database';
import { getDeviceIdentity } from '../../../core/device/deviceIdentity';
import type { CartLine, PaymentMethod } from '../domain/cart';
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

export class ProductUnavailableError extends Error {
  constructor() {
    super('Un producto del carrito ya no está disponible; quítalo y vuelve a cobrar');
  }
}

export interface CreateSaleInput {
  paymentMethod: PaymentMethod;
  /** Sin precio: se lee del catálogo local al cobrar (SPEC-007 P4). */
  lines: CartLine[];
}

/**
 * Registra una venta de forma atómica: cabecera + líneas + evento `sale_created` en la bitácora.
 * El id del evento es el mismo que el de la venta, así el backend puede deduplicar por él.
 * Toma el dispositivo y la sesión abierta; sin sesión lanza `NoOpenSessionError` (SPEC-003 RF-8, RF-11).
 * Cobra el precio vigente del catálogo local; un producto inactivo lanza `ProductUnavailableError` (SPEC-007 RF-9).
 */
export async function createSale(input: CreateSaleInput): Promise<SaleCreatedPayload> {
  if (input.lines.length === 0) throw new Error('La venta debe tener al menos una línea');
  const { id: deviceId } = await getDeviceIdentity();
  const createdAt = new Date().toISOString();
  let payload: SaleCreatedPayload | undefined;

  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Sesión y precios se leen dentro de la transacción: no pueden cambiar entre la lectura y la venta.
    const session = await txn.getFirstAsync<{ id: string }>('select id from sessions where closed_at is null');
    if (!session) throw new NoOpenSessionError();

    const ids = input.lines.map((line) => line.productId);
    const rows = await txn.getAllAsync<{ id: string; unit_price_cents: number; active: number }>(
      `select id, unit_price_cents, active from products where id in (${ids.map(() => '?').join(', ')})`,
      ids
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    const lines: SaleLineInput[] = input.lines.map((line) => {
      const product = byId.get(line.productId);
      if (!product?.active) throw new ProductUnavailableError();
      return { productId: line.productId, quantity: line.quantity, unitPriceCents: product.unit_price_cents };
    });
    validateSaleLines(lines);

    const sale: Sale = {
      id: randomUUID(),
      device_id: deviceId,
      total_cents: computeTotalCents(lines),
      payment_method: input.paymentMethod,
      created_at: createdAt,
      session_id: session.id,
    };
    const items: SaleItem[] = lines.map((line) => ({
      id: randomUUID(),
      sale_id: sale.id,
      product_id: line.productId,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
    }));
    payload = { sale, items };

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

  return payload!; // la transacción lo asigna; si falló, ya lanzó
}
