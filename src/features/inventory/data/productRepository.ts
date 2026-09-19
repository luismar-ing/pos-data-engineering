import { getDatabase } from "../../../core/db/database";

export interface Product {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    unit_price: number;
    active: number;
}

export async function getAllProducts(): Promise<Product[]> {
    const db = await getDatabase();
    return db.getAllSync<Product>(
        'select * from products where active = 1 order by name'
    )
}

export async function getProductById(id: string): Promise<Product | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<Product>(
        'select * from products where id = ?', [id]
    )
    return result || null;
}

export async function insertProduct(product: Product): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
        `insert into products (id, sku, name, category, unit_price, active) values (?, ?, ?, ?, ?, ?)`,
        [product.id, product.sku, product.name, product.category, product.unit_price, product.active]
    )
}