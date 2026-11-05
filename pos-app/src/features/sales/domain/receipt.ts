// SPEC-010: texto del recibo QR. Puro: test/receipt.test.mjs lo prueba con node.
// Los imports llevan `.ts` para que node los resuelva sin bundler (allowImportingTsExtensions).
import { formatCents } from '../../../shared/utils/money.ts';
import { PAYMENT_METHODS } from './cart.ts';

export const RECEIPT_MAX_BYTES = 1000; // P2: lo que se lee desde la pantalla de un teléfono
export const RECEIPT_NAME_MAX = 24; // P4

const SEPARATOR = '-'.repeat(RECEIPT_NAME_MAX);

export interface ReceiptLine {
  name: string;
  quantity: number;
  unitPriceCents: number;
}

/** Todo sale de lo guardado en el teléfono (RF-1, RF-3). */
export interface ReceiptData {
  deviceName: string;
  /** Nulo en ventas anteriores a SPEC-003. */
  sellerName: string | null;
  saleId: string;
  createdAt: string;
  totalCents: number;
  paymentMethod: string;
  /** En el orden del carrito. */
  lines: ReceiptLine[];
}

export const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

/** Una sola línea de hasta 24 caracteres; si se recorta, el último es "…" (RF-7). Cuenta code points: no parte tildes ni emoji. */
export function truncateName(name: string): string {
  const chars = Array.from(name.replace(/\s+/g, ' ').trim());
  return chars.length <= RECEIPT_NAME_MAX ? chars.join('') : `${chars.slice(0, RECEIPT_NAME_MAX - 1).join('')}…`;
}

/** `dd/mm/aaaa hh:mm` en hora local. Sin Intl: mismo resultado en Hermes y en node. */
export function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

const moreLine = (count: number, cents: number) =>
  `… y ${count} ${count === 1 ? 'producto' : 'productos'} más ${formatCents(cents)}`;

/**
 * Texto plano del recibo (RF-2, RF-4), nunca de más de RECEIPT_MAX_BYTES en UTF-8 (RF-5).
 * Si no caben todas las líneas, cierra con "… y N productos más" por la suma de las que faltan (RF-6).
 */
export function buildReceiptText(data: ReceiptData): string {
  const payment = PAYMENT_METHODS.find((m) => m.value === data.paymentMethod)?.label ?? data.paymentMethod;
  const head = [
    `POS-DE · ${truncateName(data.deviceName)}`,
    formatReceiptDate(data.createdAt),
    `Venta ${data.saleId.slice(0, 8)}`,
    data.saleId,
    `Vendedor: ${data.sellerName ? truncateName(data.sellerName) : '—'}`,
    SEPARATOR,
  ];
  const foot = [SEPARATOR, `TOTAL ${formatCents(data.totalCents)}`, payment];

  const rows = data.lines.map((line) => {
    const cents = line.quantity * line.unitPriceCents;
    return { text: `${line.quantity} x ${truncateName(line.name)} ${formatCents(cents)}`, cents };
  });

  // Bytes con encabezado y pie unidos por '\n'; cada línea del cuerpo suma sus bytes + 1 salto.
  let used = utf8Bytes([...head, ...foot].join('\n'));
  let restCents = rows.reduce((sum, row) => sum + row.cents, 0);
  const body: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const remaining = rows.length - i - 1;
    const rowBytes = utf8Bytes(row.text) + 1;
    // Debe caber esta línea y, si quedan más, la línea "… y N" que las resume.
    const reserve = remaining > 0 ? utf8Bytes(moreLine(remaining, restCents - row.cents)) + 1 : 0;
    if (used + rowBytes + reserve > RECEIPT_MAX_BYTES) break;
    body.push(row.text);
    used += rowBytes;
    restCents -= row.cents;
  }
  // La iteración anterior ya reservó lugar para esta línea.
  if (body.length < rows.length) body.push(moreLine(rows.length - body.length, restCents));

  return [...head, ...body, ...foot].join('\n');
}
