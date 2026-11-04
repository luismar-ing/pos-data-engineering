import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { formatCents } from '../../../shared/utils/money';
import { syncCatalog } from '../data/catalogSync';
import { getAllProducts, type Product } from '../data/productRepository';
import { getAvailableQuota } from '../../leases/data/leaseRepository';

/** Inventario: catálogo local, también sin red (SPEC-004 RF-2, RF-9), con lo disponible en préstamo (SPEC-005 RF-8). */
export function InventoryScreen() {
  const syncedAt = useSessionStore((s) => s.catalogSyncedAt);
  const leasesUpdatedAt = useSessionStore((s) => s.leasesUpdatedAt);
  const [products, setProducts] = useState<Product[]>([]);
  const [available, setAvailable] = useState<Map<string, number>>(new Map());
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(() => {
    Promise.all([getAllProducts(), getAvailableQuota()])
      .then(([rows, quota]) => {
        setProducts(rows);
        setAvailable(quota);
      })
      .catch((error) => console.error('Error al leer el catálogo local', error));
  }, []);

  useFocusEffect(reload);
  useEffect(reload, [syncedAt, leasesUpdatedAt, reload]); // la descarga del arranque puede terminar con la pantalla abierta

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
      <View style={styles.header}>
        <Text style={styles.updated}>
          {syncedAt ? `Actualizado: ${new Date(syncedAt).toLocaleString()}` : 'Catálogo nunca descargado'}
        </Text>
        {syncing ? <ActivityIndicator /> : <Button title="Actualizar" onPress={handleSync} />}
      </View>
      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={styles.name}>{item.name}</Text>
              {item.category && <Text style={styles.category}>{item.category}</Text>}
            </View>
            <Text style={styles.available}>{`Disponible ${available.get(item.id) ?? 0}`}</Text>
            <Text style={styles.price}>{formatCents(item.unit_price_cents)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No hay productos. Conéctate a la red y toca Actualizar.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, gap: 8 },
  updated: { flex: 1, color: '#666' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: '#eee' },
  flex: { flex: 1 },
  name: { fontSize: 16 },
  category: { color: '#666' },
  price: { fontSize: 16, fontVariant: ['tabular-nums'] },
  available: { color: '#666', marginRight: 12, fontVariant: ['tabular-nums'] },
  empty: { padding: 24, textAlign: 'center', color: '#666' },
});
