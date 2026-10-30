export interface SaleLineInput {
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

/** Valida las líneas de una venta. Lanza un Error con el motivo si alguna no es válida. */
export function validateSaleLines(lines: SaleLineInput[]): void {
  if (lines.length === 0) {
    throw new Error('La venta debe tener al menos una línea');
  }
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Cantidad inválida para ${line.productId}: ${line.quantity}`);
    }
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
      throw new Error(`Precio inválido para ${line.productId}: ${line.unitPriceCents}`);
    }
  }
}

/** Total en centavos. Aritmética entera: 3 × 10 = 30, sin errores de coma flotante. */
export function computeTotalCents(lines: SaleLineInput[]): number {
  return lines.reduce((total, line) => total + line.quantity * line.unitPriceCents, 0);
}
