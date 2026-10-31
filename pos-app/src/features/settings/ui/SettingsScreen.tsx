import { useCallback, useState } from 'react';
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDeviceIdentity, setDeviceName, type DeviceIdentity } from '../../../core/device/deviceIdentity';
import { ensureRegistered } from '../../../core/device/registration';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { closeSession } from '../../session/data/sessionRepository';

/** Ajustes: dispositivo y sesión abierta (SPEC-003 RF-13). */
export function SettingsScreen() {
  const session = useSessionStore((s) => s.currentSession);
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession);
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const current = await getDeviceIdentity();
    setIdentity(current);
    setName(current.name);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((error) => console.error('Error al leer la identidad del dispositivo', error));
    }, [reload])
  );

  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    try {
      await task();
      await reload();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const saveName = () =>
    run(async () => {
      await setDeviceName(name);
      await ensureRegistered(true);
    });

  const retryRegistration = () =>
    run(async () => {
      if (!(await ensureRegistered())) Alert.alert('Sin registrar', 'No se pudo contactar al servidor. Revisa la red o EXPO_PUBLIC_API_URL.');
    });

  const confirmClose = () =>
    Alert.alert('Cerrar sesión', `¿Cerrar la sesión de ${session?.seller_name}? No podrás cobrar hasta abrir otra.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => run(async () => { await closeSession(); setCurrentSession(null); }) },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Dispositivo</Text>
      <Text style={styles.label}>Nombre</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} value={name} onChangeText={setName} accessibilityLabel="Nombre del dispositivo" />
        <Button title="Guardar" onPress={saveName} disabled={busy || !name.trim() || name.trim() === identity?.name} />
      </View>
      <Text style={styles.label}>Identificador</Text>
      <Text selectable>{identity?.id ?? '…'}</Text>
      <Text style={styles.label}>Registro en el servidor</Text>
      <Text>{identity?.registeredAt ? `Registrado (${new Date(identity.registeredAt).toLocaleString()})` : 'Pendiente'}</Text>
      {identity && !identity.registeredAt && <Button title="Reintentar registro" onPress={retryRegistration} disabled={busy} />}

      <Text style={styles.section}>Sesión</Text>
      {session ? (
        <>
          <Text>Vendedor: {session.seller_name}</Text>
          <Text>Desde: {new Date(session.opened_at).toLocaleString()}</Text>
          <Button title="Cerrar sesión" color="#c0392b" onPress={confirmClose} disabled={busy} />
        </>
      ) : (
        <Text>No hay sesión abierta. Ábrela desde Venta.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 8 },
  section: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  label: { color: '#666', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
});
