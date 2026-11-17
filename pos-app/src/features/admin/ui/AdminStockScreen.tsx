import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Pill, type PillTone } from '../../../shared/ui/Pill';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, radius, space } from '../../../shared/ui/theme';
import { formatTime } from '../../../shared/utils/time';
import { getStock, type StockProduct, type StockStatus } from '../data/adminApi';
import { ProductFormSheet } from './ProductFormSheet';

const STATUS: Record<StockStatus, { label: string; tone: PillTone }> = {
  ok: { label: 'Cuadra', tone: 'action' },
  no_cuadra: { label: 'No cuadra', tone: 'danger' },
  sync_supera_stock: { label: 'Vendido de más', tone: 'danger' },
  sin_stock_inicial: { label: 'Sin stock inicial', tone: 'warning' },
};

/** Stock central, prestado e informado por producto, y si cuadra (SPEC-013 RF-13, RF-14); alta y edición (SPEC-014). */
export function AdminStockScreen() {
  const isOnline = useSessionStore((s) => s.isOnline);
  const [data, setData] = useState<{ generated_at: string; products: StockProduct[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // SPEC-014: undefined = cerrada, null = alta, id = edición (se lee de la lista recargada).
  const [editing, setEditing] = useState<string | null | undefined>(undefined);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await getStock());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // RF-14: los que no cuadran, arriba; el servidor ya los ordena por nombre.
  const products = useMemo(() => (data ? [...data.products].sort((a, b) => Number(a.status === 'ok') - Number(b.status === 'ok')) : []), [data]);
  const wrong = products.filter((p) => p.status !== 'ok').length;
  const selected = editing ? (products.find((p) => p.product_id === editing) ?? null) : null;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Stock"
        subtitle={data ? `${wrong === 0 ? 'Todo cuadra' : `${wrong} no cuadra${wrong === 1 ? '' : 'n'}`} · datos de las ${formatTime(data.generated_at)}` : null}
        right={<Button label="Actualizar" icon="actualizar" variant="outline" compact onPress={load} disabled={busy || !isOnline} />}
      />
      <View style={styles.actions}>
        <Button label="Nuevo producto" variant="secondary" compact onPress={() => setEditing(null)} disabled={!isOnline} />
      </View>
      {error && <AppText style={styles.error}>{error}</AppText>}
      {!data && !error && <AppText style={styles.loading} variant="caption">Cargando…</AppText>}
      <FlatList
        data={products}
        keyExtractor={(p) => p.product_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <StockRow product={item} onPress={() => setEditing(item.product_id)} />}
      />
      <ProductFormSheet
        visible={editing !== undefined}
        product={selected}
        onClose={() => setEditing(undefined)}
        onChanged={() => void load()}
      />
    </View>
  );
}

function StockRow({ product: p, onPress }: { product: StockProduct; onPress: () => void }) {
  const status = STATUS[p.status];
  return (
    <Pressable
      style={[styles.row, p.status !== 'ok' && styles.rowWrong]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Editar producto o ajustar stock"
    >
      <View style={styles.rowHead}>
        <AppText variant="strong" style={styles.name} numberOfLines={1}>
          {p.name}
        </AppText>
        {!p.active && <Pill label="Inactivo" tone="neutral" />}
        <Pill label={status.label} tone={status.tone} />
      </View>
      <View style={styles.numbers}>
        <StockFigure value={p.central_stock} label="central" />
        <StockFigure value={p.leased_active} label="prestado" />
        <StockFigure value={p.reported_sold} label="informado" />
        <StockFigure value={p.initial_stock} label="inicial" />
      </View>
    </Pressable>
  );
}

function StockFigure({ value, label }: { value: number | null; label: string }) {
  return (
    <View style={styles.number}>
      <AppText variant="figureSmall">{value ?? '—'}</AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 10 },
  error: { color: colors.danger, paddingHorizontal: space.xl },
  loading: { paddingHorizontal: space.xl },
  actions: { paddingHorizontal: space.xl, paddingBottom: space.md, alignItems: 'flex-start' },
  row: { backgroundColor: colors.background, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  rowWrong: { borderWidth: 2, borderColor: colors.danger },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1 },
  numbers: { flexDirection: 'row', gap: space.sm },
  number: { flex: 1 },
});
