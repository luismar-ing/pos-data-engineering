import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getDatabase } from './core/db/database';
import { RootNavigator } from './navigation/RootNavigator';

type DbState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export default function App() {
  const [db, setDb] = useState<DbState>({ status: 'loading' });

  useEffect(() => {
    getDatabase()
      .then(() => setDb({ status: 'ready' }))
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
