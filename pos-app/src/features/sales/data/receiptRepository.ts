import { getDatabase } from '../../../core/db/database';
import { getDeviceIdentity } from '../../../core/device/deviceIdentity';
import { buildReceiptText, utf8Bytes } from '../domain/receipt';
import { RECEIPT_ITEMS_SQL, RECEIPT_SALE_SQL } from './receiptSql';

/** Texto del recibo QR de una venta, solo con datos locales y sin escribir nada (SPEC-010 RF-1, RF-11). */
export async function getReceiptText(saleId: string): Promise<string> {
  const started = Date.now();
  const db = await getDatabase();
  const sale = await db.getFirstAsync<{
    id: string;
    total_cents: number;
    payment_method: string;
    created_at: string;
    seller_name: string | null;
  }>(RECEIPT_SALE_SQL, [saleId]);
  if (!sale) throw new Error('No se encontró la venta');
  const items = await db.getAllAsync<{ quantity: number; unit_price_cents: number; name: string }>(RECEIPT_ITEMS_SQL, [saleId]);
  const { name: deviceName } = await getDeviceIdentity();

  const text = buildReceiptText({
    deviceName,
    sellerName: sale.seller_name,
    saleId: sale.id,
    createdAt: sale.created_at,
    totalCents: sale.total_cents,
    paymentMethod: sale.payment_method,
    lines: items.map((item) => ({ name: item.name, quantity: item.quantity, unitPriceCents: item.unit_price_cents })),
  });
  if (__DEV__) console.log(`Recibo armado en ${Date.now() - started} ms, ${utf8Bytes(text)} bytes`);
  return text;
}
