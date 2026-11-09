import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_700Bold } from '@expo-google-fonts/barlow/700Bold';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed/600SemiBold';
import { BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed/700Bold';
import { BarlowSemiCondensed_800ExtraBold } from '@expo-google-fonts/barlow-semi-condensed/800ExtraBold';
import { getDatabase } from './core/db/database';
import { getDeviceIdentity } from './core/device/deviceIdentity';
import { ensureRegistered } from './core/device/registration';
import { isCatalogStale } from './core/network/connectivity';
import { onReconnect, startConnectivityMonitor } from './core/network/monitor';
import { syncEvents } from './core/sync/syncWorker';
import { leaseSync } from './features/leases/data/leaseSync';
import { getCatalogSyncedAt } from './features/inventory/data/catalogRepository';
import { syncCatalog } from './features/inventory/data/catalogSync';
import { getOpenSession } from './features/session/data/sessionRepository';
import { useSessionStore } from './shared/store/sessionStore';
import { RootNavigator } from './navigation/RootNavigator';
import { colors, fonts } from './shared/ui/theme';

const BACKGROUND_SYNC_MS = 30_000;

// SPEC-012 RNF-3: los .ttf van en el paquete de la app (require), así que cargan sin red y en Expo Go.
const FONT_FILES = {
  [fonts.regular]: Barlow_400Regular,
  [fonts.medium]: Barlow_500Medium,
  [fonts.semibold]: Barlow_600SemiBold,
  [fonts.bold]: Barlow_700Bold,
  [fonts.displaySemibold]: BarlowSemiCondensed_600SemiBold,
  [fonts.displayBold]: BarlowSemiCondensed_700Bold,
  [fonts.displayHeavy]: BarlowSemiCondensed_800ExtraBold,
};

type DbState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export default function App() {
  const [db, setDb] = useState<DbState>({ status: 'loading' });
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

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
        // SPEC-005 RF-9, RF-10 y SPEC-008 RF-4: préstamos y bitácora al arrancar, al reconectar y cada 30 s.
        const backgroundSync = () => {
          void leaseSync();
          void syncEvents();
        };
        onReconnect(backgroundSync);
        backgroundSync();
        setInterval(backgroundSync, BACKGROUND_SYNC_MS);
      })
      .catch((error: unknown) => {
        console.error('Error al abrir la base de datos local', error);
        setDb({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
  }, []);

  if (fontError) console.error('No se pudieron cargar las fuentes; se usa la del sistema', fontError);
  if (db.status === 'loading' || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.action} />
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

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
});
