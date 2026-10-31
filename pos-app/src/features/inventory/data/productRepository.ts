import { getDatabase } from '../../../core/db/database';

export interface Product {
  id: string;
  name: string;
  category: string | null;
  unit_price_cents: number;
  active: number;
}

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDatabase();
  return db.getAllAsync<Product>(
    'select id, name, category, unit_price_cents, active from products where active = 1 order by name'
  );
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Product>(
    'select id, name, category, unit_price_cents, active from products where id = ?',
    [id]
  );
}
