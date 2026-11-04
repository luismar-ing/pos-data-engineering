import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDatabase } from './core/db/database';
import { getDeviceIdentity } from './core/device/deviceIdentity';
import { ensureRegistered } from './core/device/registration';
import { isCatalogStale } from './core/network/connectivity';
import { onReconnect, startConnectivityMonitor } from './core/network/monitor';
import { leaseSync } from './features/leases/data/leaseSync';
import { getCatalogSyncedAt } from './features/inventory/data/catalogRepository';
import { syncCatalog } from './features/inventory/data/catalogSync';
import { getOpenSession } from './features/session/data/sessionRepository';
import { useSessionStore } from './shared/store/sessionStore';
import { RootNavigator } from './navigation/RootNavigator';

const LEASE_CHECK_MS = 30_000;

type DbState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export default function App() {
  const [db, setDb] = useState<DbState>({ status: 'loading' });

  useEffect(() => {
    getDatabase()
      .then(async (database) => {
        await getDeviceIdentity(); // RF-1: crea la identidad en el primer arranque, sin red
        const store = useSessionStore.getState();
        store.setCurrentSession(await getOpenSession()); // RF-10
        store.setCatalogSyncedAt(await getCatalogSyncedAt(database));
        setDb({ status: 'ready' });
        void ensureRegistered(); // RF-2: en segundo plano, sin bloquear la UI
        // SPEC-004 RF-1: sin red sigue con el catálogo guardado; el error se ve al actualizar desde Inventario.
        syncCatalog().catch(() => {});
        // SPEC-006 RF-7: al volver la red, registro pendiente (TD-022) y catálogo si tiene más de 5 min (P4).
        onReconnect(() => {
          void ensureRegistered();
          if (isCatalogStale(useSessionStore.getState().catalogSyncedAt, Date.now())) syncCatalog().catch(() => {});
        });
        startConnectivityMonitor();
        // SPEC-005 RF-9, RF-10: préstamos al arrancar, al reconectar y cada 30 s (vencimientos).
        onReconnect(() => void leaseSync());
        void leaseSync();
        setInterval(() => void leaseSync(), LEASE_CHECK_MS);
      })
      .catch((error: unknown) => {
        console.error('Error al abrir la base de datos local', error);
        setDb({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
  }, []);

  if (db.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (db.status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>No se pudo abrir la base de datos</Text>
        <Text>{db.message}</Text>
      </View>
    );
  }

  return <RootNavigator />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
});
