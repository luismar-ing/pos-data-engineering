import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import { Pill } from '../../../shared/ui/Pill';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, fonts, radius, space } from '../../../shared/ui/theme';
import { formatTime } from '../../../shared/utils/time';
import { getLowStockIds } from '../../analytics/data/analyticsRepository';
import { getAllProducts, type Product } from '../../inventory/data/productRepository';
import { getAvailableQuota } from '../../leases/data/leaseRepository';
import { OpenSessionForm } from '../../session/ui/OpenSessionForm';
import { categoriesOf, filterProducts, priceCart } from '../domain/cart';
import { CartBar } from './CartBar';
import { CategoryFilter } from './CategoryFilter';
import { CheckoutModal } from './CheckoutModal';
import { ProductTile } from './ProductTile';

/** Venta: cabecera, buscador, filtros y cuadrícula de productos, con la barra de cobro abajo (SPEC-012 RF-5..RF-11). Sin sesión no se cobra (SPEC-003 CA-6). */
export function SaleScreen() {
  const session = useSessionStore((s) => s.currentSession);
  const isOnline = useSessionStore((s) => s.isOnline);
  const syncedAt = useSessionStore((s) => s.catalogSyncedAt);
  const leasesUpdatedAt = useSessionStore((s) => s.leasesUpdatedAt);
  const cart = useSessionStore((s) => s.cart);
  const addToCart = useSessionStore((s) => s.addToCart);
  const [products, setProducts] = useState<Product[]>([]);
  const [available, setAvailable] = useState<Map<string, number>>(new Map());
  const [low, setLow] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const tileWidth = (useWindowDimensions().width - space.xl * 2 - space.md) / 2;

  const reload = useCallback(() => {
    Promise.all([getAllProducts(), getAvailableQuota(), getLowStockIds(Date.now())])
      .then(([rows, quota, lowIds]) => {
        setProducts(rows);
        setAvailable(quota);
        setLow(lowIds);
      })
      .catch((error) => console.error('Error al leer el catálogo local', error));
  }, []);

  useFocusEffect(reload);
  useEffect(reload, [syncedAt, leasesUpdatedAt, reload]);

  const priced = useMemo(() => priceCart(cart, new Map(products.map((p) => [p.id, p]))), [cart, products]);
  const categories = useMemo(() => categoriesOf(products), [products]);
  const activeCategory = category !== null && categories.includes(category) ? category : null; // la categoría pudo salir del catálogo
  const visible = useMemo(() => filterProducts(products, query, activeCategory), [products, query, activeCategory]);
  const qtyById = useMemo(() => new Map(cart.map((line) => [line.productId, line.quantity])), [cart]);

  if (!session) return <OpenSessionForm />;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Venta"
        subtitle={`${session.seller_name}, desde las ${formatTime(session.opened_at)}`}
        right={<Pill label={isOnline ? 'En línea' : 'Sin conexión'} tone={isOnline ? 'action' : 'warning'} dot />}
      />
      <View style={styles.search}>
        <Icon name="buscar" size={22} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar producto"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel="Buscar producto por nombre"
          clearButtonMode="while-editing"
        />
      </View>
      <CategoryFilter categories={categories} selected={activeCategory} onSelect={setCategory} />
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.columns}
        numColumns={2}
        data={visible}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ProductTile
            product={item}
            left={available.get(item.id) ?? 0}
            low={low.has(item.id)}
            qty={qtyById.get(item.id) ?? 0}
            width={tileWidth}
            onAdd={addToCart}
          />
        )}
        ListEmptyComponent={
          <AppText style={styles.empty}>
            {products.length ? 'Ningún producto coincide.' : 'No hay catálogo. Actualízalo desde Inventario con red.'}
          </AppText>
        }
      />
      <CartBar priced={priced} onOpen={() => setCheckingOut(true)} />
      <CheckoutModal visible={checkingOut} priced={priced} available={available} onClose={() => setCheckingOut(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    marginHorizontal: space.xl,
    marginBottom: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 17, color: colors.ink, paddingVertical: 10 },
  list: { flex: 1, marginTop: space.lg },
  grid: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md },
  columns: { gap: space.md },
  empty: { padding: space.xxl, textAlign: 'center', color: colors.muted },
});
