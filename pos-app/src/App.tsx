import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDatabase } from './core/db/database';
import { getDeviceIdentity } from './core/device/deviceIdentity';
import { ensureRegistered } from './core/device/registration';
import { getCatalogSyncedAt } from './features/inventory/data/catalogRepository';
import { syncCatalog } from './features/inventory/data/catalogSync';
import { getOpenSession } from './features/session/data/sessionRepository';
import { useSessionStore } from './shared/store/sessionStore';
import { RootNavigator } from './navigation/RootNavigator';

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
