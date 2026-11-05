// SPEC-010: datos del recibo. Solo lectura (RF-11). Sin imports: test/receipt.test.mjs las prueba con node:sqlite.

/** La venta y el vendedor de su sesión (nulo en ventas anteriores a SPEC-003). */
export const RECEIPT_SALE_SQL = `
  select s.id, s.total_cents, s.payment_method, s.created_at, se.seller_name
  from sales s
  left join sessions se on se.id = s.session_id
  where s.id = ?
`;

/** Líneas con el precio guardado (RF-3), en el orden del carrito: se insertan en ese orden. */
export const RECEIPT_ITEMS_SQL = `
  select si.quantity, si.unit_price_cents, p.name
  from sale_items si
  join products p on p.id = si.product_id
  where si.sale_id = ?
  order by si.rowid
`;
