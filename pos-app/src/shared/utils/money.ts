/** Montos en centavos enteros (SPEC-001). Sin imports de Expo: test/cart.test.mjs lo prueba con node. */

export const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Lee un monto escrito por el vendedor: "100", "100.5", "100,50". Devuelve null si no es válido.
 * Rechaza más de 2 decimales ("1.234" podría ser un separador de miles) y montos de más de 7 cifras.
 */
export function parseMoneyToCents(text: string): number | null {
  const match = /^\s*(\d{1,7})(?:[.,](\d{1,2}))?\s*$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}

/** Cambio a devolver. Negativo si el monto recibido no alcanza. */
export const computeChangeCents = (totalCents: number, receivedCents: number) => receivedCents - totalCents;
