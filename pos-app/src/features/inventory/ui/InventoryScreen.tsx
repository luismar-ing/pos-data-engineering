import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, SectionList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, space } from '../../../shared/ui/theme';
import { formatCents } from '../../../shared/utils/money';
import { formatTime } from '../../../shared/utils/time';
import { getLowStockIds } from '../../analytics/data/analyticsRepository';
import { getAvailableQuota } from '../../leases/data/leaseRepository';
import { syncCatalog } from '../data/catalogSync';
import { getAllProducts, type Product } from '../data/productRepository';

const NO_CATEGORY = 'Sin categoría';

/**
 * Inventario: catálogo local por categoría, también sin red (SPEC-004 RF-2, RF-9), con lo disponible en préstamo
 * (SPEC-005 RF-8) y lo que se agota pronto (SPEC-012 RF-19, RF-20, P2, P5).
 */
export function InventoryScreen() {
  const syncedAt = useSessionStore((s) => s.catalogSyncedAt);
  const leasesUpdatedAt = useSessionStore((s) => s.leasesUpdatedAt);
  const isOnline = useSessionStore((s) => s.isOnline);
  const [products, setProducts] = useState<Product[]>([]);
  const [available, setAvailable] = useState<Map<string, number>>(new Map());
  const [low, setLow] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

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
  useEffect(reload, [syncedAt, leasesUpdatedAt, reload]); // la descarga del arranque puede terminar con la pantalla abierta

  const sections = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.category ?? NO_CATEGORY;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b)))
      .map(([title, data]) => ({ title, data }));
  }, [products]);

  async function handleSync() {
    setSyncing(true);
    try {
      await syncCatalog();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      Alert.alert('No se pudo actualizar el catálogo', `${reason}. Se mantiene el catálogo guardado.`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Inventario"
        subtitle={syncedAt ? `Actualizado a las ${formatTime(syncedAt)}` : 'Catálogo nunca descargado'}
        right={
          <Button
            label={syncing ? 'Actualizando…' : 'Actualizar'}
            icon="actualizar"
            variant="outline"
            compact
            onPress={handleSync}
            disabled={syncing || !isOnline}
            accessibilityLabel={isOnline ? 'Actualizar catálogo' : 'Actualizar catálogo, no disponible sin conexión'}
          />
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <AppText variant="heading" style={styles.section} accessibilityRole="header">
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => {
          const left = available.get(item.id) ?? 0;
          const isLow = left > 0 && low.has(item.id);
          const color = left === 0 ? colors.danger : isLow ? colors.warningText : colors.ink;
          const status = left === 0 ? 'agotado' : isLow ? 'se agota pronto' : 'disponibles';
          return (
            <View style={styles.row} accessible accessibilityLabel={`${item.name}, ${formatCents(item.unit_price_cents)}, ${left} ${status}`}>
              <View style={styles.flex}>
                <AppText variant="strong">{item.name}</AppText>
                <AppText variant="caption">{formatCents(item.unit_price_cents)}</AppText>
              </View>
              <View style={styles.right}>
                <AppText variant="figure" style={{ color }}>
                  {left}
                </AppText>
                <AppText variant="caption" style={[styles.status, isLow && styles.lowStatus]}>
                  {status}
                </AppText>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<AppText style={styles.empty}>No hay productos. Conéctate a la red y toca Actualizar.</AppText>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl },
  section: { marginTop: space.lg, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, borderTopWidth: 1, borderColor: colors.line, paddingVertical: 6 },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end' },
  status: { fontSize: 12, lineHeight: 16 },
  lowStatus: { color: colors.warningText },
  empty: { padding: space.xxl, textAlign: 'center', color: colors.muted },
});
