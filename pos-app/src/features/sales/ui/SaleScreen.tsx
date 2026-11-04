import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { formatCents } from '../../../shared/utils/money';
import { getAllProducts, type Product } from '../../inventory/data/productRepository';
import { getAvailableQuota } from '../../leases/data/leaseRepository';
import { OpenSessionForm } from '../../session/ui/OpenSessionForm';
import { matchesSearch, priceCart } from '../domain/cart';
import { CartPanel } from './CartPanel';
import { CheckoutModal } from './CheckoutModal';

/** Venta: catálogo con buscador arriba, carrito abajo (SPEC-007 P5). Sin sesión no se cobra (SPEC-003 CA-6). */
export function SaleScreen() {
  const session = useSessionStore((s) => s.currentSession);
  const syncedAt = useSessionStore((s) => s.catalogSyncedAt);
  const leasesUpdatedAt = useSessionStore((s) => s.leasesUpdatedAt);
  const cart = useSessionStore((s) => s.cart);
  const addToCart = useSessionStore((s) => s.addToCart);
  const [products, setProducts] = useState<Product[]>([]);
  const [available, setAvailable] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const reload = useCallback(() => {
    Promise.all([getAllProducts(), getAvailableQuota()])
      .then(([rows, quota]) => {
        setProducts(rows);
        setAvailable(quota);
      })
      .catch((error) => console.error('Error al leer el catálogo local', error));
  }, []);
  useFocusEffect(reload);
  // Una actualización del catálogo cambia precios y bajas; un cambio de préstamos, lo disponible (SPEC-005 RF-8).
  useEffect(reload, [syncedAt, leasesUpdatedAt, reload]);

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
        renderItem={({ item }) => {
          const left = available.get(item.id) ?? 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed, left === 0 && styles.soldOut]}
              onPress={() => addToCart(item.id, left)}
              disabled={left === 0}
              accessibilityRole="button"
              accessibilityState={{ disabled: left === 0 }}
              accessibilityLabel={
                left === 0 ? `${item.name}, agotado` : `Agregar ${item.name}, ${formatCents(item.unit_price_cents)}, quedan ${left}`
              }
            >
              <View style={styles.flex}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={left === 0 ? styles.soldOutText : styles.left}>{left === 0 ? 'Agotado' : `Quedan ${left}`}</Text>
              </View>
              <Text style={styles.price}>{formatCents(item.unit_price_cents)}</Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {products.length ? 'Ningún producto coincide.' : 'No hay catálogo. Actualízalo desde Inventario con red.'}
          </Text>
        }
      />
      <CartPanel priced={priced} available={available} onCheckout={() => setCheckingOut(true)} />
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
  flex: { flex: 1, paddingVertical: 6 },
  name: { fontSize: 16 },
  left: { color: '#666', fontSize: 13 },
  soldOut: { opacity: 0.5 },
  soldOutText: { color: '#b45309', fontSize: 13, fontWeight: '600' },
  price: { fontSize: 16, fontVariant: ['tabular-nums'] },
  empty: { padding: 24, textAlign: 'center', color: '#666' },
});
