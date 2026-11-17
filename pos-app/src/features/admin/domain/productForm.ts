// SPEC-014 RF-13..RF-15: validación del formulario de producto. Sin imports de Expo: test/admin.test.mjs la prueba con node.
import { parseMoneyToCents } from '../../../shared/utils/money.ts';

export interface ProductFormText {
  name: string;
  category: string;
  price: string;
  /** Solo al crear. */
  initialStock?: string;
}

export interface ProductFormValues {
  name: string;
  category: string | null;
  unit_price_cents: number;
  initial_stock?: number;
}

const NAME_MAX = 100;
const CATEGORY_MAX = 50;
const STOCK_MAX = 1_000_000;

/** Devuelve los valores o el primer error, en el texto que ve el administrador. */
export function parseProductForm(form: ProductFormText): ProductFormValues | { error: string } {
  const name = form.name.trim();
  if (!name) return { error: 'Escribe el nombre' };
  if (name.length > NAME_MAX) return { error: `El nombre no puede pasar de ${NAME_MAX} caracteres` };
  const category = form.category.trim();
  if (category.length > CATEGORY_MAX) return { error: `La categoría no puede pasar de ${CATEGORY_MAX} caracteres` };
  const unit_price_cents = parseMoneyToCents(form.price);
  if (unit_price_cents === null) return { error: 'Precio no válido (ej. 25 o 25.50)' };
  const values: ProductFormValues = { name, category: category || null, unit_price_cents };
  if (form.initialStock !== undefined) {
    const stock = parseCount(form.initialStock);
    if (stock === null || stock < 0) return { error: 'Stock inicial no válido (número entero, 0 o más)' };
    values.initial_stock = stock;
  }
  return values;
}

/** Ajuste de stock central: entero distinto de 0, con signo ("+20", "-5", "20"). */
export function parseStockDelta(text: string): number | null {
  const delta = parseCount(text);
  return delta === null || delta === 0 ? null : delta;
}

function parseCount(text: string): number | null {
  const match = /^\s*([+-]?)(\d{1,7})\s*$/.exec(text);
  if (!match) return null;
  const value = Number(match[2]) * (match[1] === '-' ? -1 : 1);
  return Math.abs(value) > STOCK_MAX ? null : value;
}
