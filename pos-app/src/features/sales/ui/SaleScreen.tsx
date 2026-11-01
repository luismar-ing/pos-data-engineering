import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { formatCents } from '../../../shared/utils/money';
import { getAllProducts, type Product } from '../../inventory/data/productRepository';
import { OpenSessionForm } from '../../session/ui/OpenSessionForm';
import { matchesSearch, priceCart } from '../domain/cart';
import { CartPanel } from './CartPanel';
import { CheckoutModal } from './CheckoutModal';

/** Venta: catálogo con buscador arriba, carrito abajo (SPEC-007 P5). Sin sesión no se cobra (SPEC-003 CA-6). */
export function SaleScreen() {
  const session = useSessionStore((s) => s.currentSession);
  const syncedAt = useSessionStore((s) => s.catalogSyncedAt);
  const cart = useSessionStore((s) => s.cart);
  const addToCart = useSessionStore((s) => s.addToCart);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const reload = useCallback(() => {
    getAllProducts()
      .then(setProducts)
      .catch((error) => console.error('Error al leer el catálogo local', error));
  }, []);
  useFocusEffect(reload);
  useEffect(reload, [syncedAt, reload]); // una actualización del catálogo cambia precios y bajas

  const priced = useMemo(() => priceCart(cart, new Map(products.map((p) => [p.id, p]))), [cart, products]);
  const visible = useMemo(() => products.filter((p) => matchesSearch(p.name, query)), [products, query]);

  if (!session) return <OpenSessionForm />;

  return (
    <View style={styles.container}>
      <Text style={styles.session}>Sesión de {session.seller_name}</Text>
      <TextInput
        style={styles.search}
        placeholder="Buscar producto"
        value={query}
        onChangeText={setQuery}
        accessibilityLabel="Buscar producto por nombre"
        clearButtonMode="while-editing"
      />
      <FlatList
        style={styles.list}
        data={visible}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => addToCart(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Agregar ${item.name}, ${formatCents(item.unit_price_cents)}`}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>{formatCents(item.unit_price_cents)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {products.length ? 'Ningún producto coincide.' : 'No hay catálogo. Actualízalo desde Inventario con red.'}
          </Text>
        }
      />
      <CartPanel priced={priced} onCheckout={() => setCheckingOut(true)} />
      <CheckoutModal visible={checkingOut} totalCents={priced.totalCents} onClose={() => setCheckingOut(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  session: { paddingHorizontal: 16, paddingTop: 12, color: '#666' },
  search: { margin: 16, marginBottom: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
  list: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16, borderTopWidth: 1, borderColor: '#eee' },
  pressed: { backgroundColor: '#f2f2f2' },
  name: { flex: 1, fontSize: 16 },
  price: { fontSize: 16, fontVariant: ['tabular-nums'] },
  empty: { padding: 24, textAlign: 'center', color: '#666' },
});
