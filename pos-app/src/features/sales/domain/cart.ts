// Lógica pura del carrito (SPEC-007). Sin imports de Expo en ejecución: test/cart.test.mjs la prueba con node.
import type { Product } from '../../inventory/data/productRepository';

/** El carrito guarda solo producto y cantidad; el precio se lee del catálogo local (P4). */
export interface CartLine {
  productId: string;
  quantity: number;
}

export const MAX_QUANTITY = 999;

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];

/**
 * Suma `delta` a la línea (la crea si no existe). En 0 o menos la quita (RF-3).
 * Tope: lo disponible en el préstamo (SPEC-005 RF-8) y MAX_QUANTITY. Subir ya en el tope no cambia nada.
 */
export function changeQuantity(cart: CartLine[], productId: string, delta: number, max = MAX_QUANTITY): CartLine[] {
  const line = cart.find((l) => l.productId === productId);
  const current = line?.quantity ?? 0;
  const cap = Math.min(max, MAX_QUANTITY);
  if (delta > 0 && current >= cap) return cart;
  const quantity = Math.min(cap, current + delta);
  if (quantity <= 0) return removeLine(cart, productId);
  if (!line) return [...cart, { productId, quantity }];
  return cart.map((l) => (l.productId === productId ? { ...l, quantity } : l));
}

/** Tocar un producto: agrega 1 o suma 1 si ya está (RF-2, cierra TD-016). */
export const addProduct = (cart: CartLine[], productId: string, max = MAX_QUANTITY) => changeQuantity(cart, productId, 1, max);

export const removeLine = (cart: CartLine[], productId: string) => cart.filter((l) => l.productId !== productId);

export interface PricedLine extends CartLine {
  name: string;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface PricedCart {
  lines: PricedLine[];
  /** Líneas cuyo producto ya no está activo en el catálogo local: no suman al total y bloquean el cobro. */
  unavailable: CartLine[];
  totalCents: number;
}

/** Precios vigentes del catálogo local para cada línea (RF-4). */
export function priceCart(cart: CartLine[], productsById: Map<string, Pick<Product, 'name' | 'unit_price_cents'>>): PricedCart {
  const result: PricedCart = { lines: [], unavailable: [], totalCents: 0 };
  for (const line of cart) {
    const product = productsById.get(line.productId);
    if (!product) {
      result.unavailable.push(line);
      continue;
    }
    const subtotalCents = line.quantity * product.unit_price_cents;
    result.lines.push({ ...line, name: product.name, unitPriceCents: product.unit_price_cents, subtotalCents });
    result.totalCents += subtotalCents;
  }
  return result;
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Búsqueda por nombre sin distinguir mayúsculas ni acentos (CA-3). Consulta vacía: todo coincide. */
export const matchesSearch = (name: string, query: string) => fold(name).includes(fold(query.trim()));
