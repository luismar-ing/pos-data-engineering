import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Button, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ApiError } from '../../../core/api/client';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { syncCatalog } from '../data/catalogSync';
import { getAllProducts, type Product } from '../data/productRepository';

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Inventario: catálogo local, también sin red (SPEC-004 RF-2, RF-9). El stock por lease llega con SPEC-005. */
export function InventoryScreen() {
  const syncedAt = useSessionStore((s) => s.catalogSyncedAt);
  const [products, setProducts] = useState<Product[]>([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(() => {
    getAllProducts()
      .then(setProducts)
      .catch((error) => console.error('Error al leer el catálogo local', error));
  }, []);

  useFocusEffect(reload);
  useEffect(reload, [syncedAt, reload]); // la descarga del arranque puede terminar con la pantalla abierta

  async function handleSync() {
    setSyncing(true);
    try {
      await syncCatalog();
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : error instanceof TypeError ? 'Sin conexión con el servidor' : String(error);
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
            <Text style={styles.price}>{formatPrice(item.unit_price_cents)}</Text>
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
  empty: { padding: 24, textAlign: 'center', color: '#666' },
});
