/** Producto tal como llega de `GET /catalogo` (SPEC-004). */
export interface CatalogProduct {
  id: string;
  name: string;
  category: string | null;
  unit_price_cents: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida la respuesta del servidor antes de guardarla (RF-7).
 * Lanza si un solo producto no cumple: la descarga entera se descarta. Ignora campos extra.
 */
export function parseCatalog(json: unknown): CatalogProduct[] {
  if (!Array.isArray(json)) throw new Error('El catálogo no es una lista');

  const seen = new Set<string>();
  return json.map((item: unknown, i) => {
    const p = (item ?? {}) as Record<string, unknown>;
    const fail = (field: string) => {
      throw new Error(`Producto ${i} inválido: ${field}`);
    };
    if (typeof p.id !== 'string' || !UUID.test(p.id)) fail('id');
    if (seen.has(p.id as string)) fail('id repetido');
    if (typeof p.name !== 'string' || !p.name.trim()) fail('name');
    if (p.category !== null && typeof p.category !== 'string') fail('category');
    if (!Number.isInteger(p.unit_price_cents) || (p.unit_price_cents as number) < 0) fail('unit_price_cents');

    seen.add(p.id as string);
    return {
      id: p.id as string,
      name: (p.name as string).trim(),
      category: p.category as string | null,
      unit_price_cents: p.unit_price_cents as number,
    };
  });
}
