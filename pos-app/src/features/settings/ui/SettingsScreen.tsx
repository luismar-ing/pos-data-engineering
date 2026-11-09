import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDeviceIdentity, setDeviceName, type DeviceIdentity } from '../../../core/device/deviceIdentity';
import { ensureRegistered } from '../../../core/device/registration';
import { getSyncSummary, type SyncSummary } from '../../../core/sync/syncRepository';
import { syncEvents } from '../../../core/sync/syncWorker';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Icon } from '../../../shared/ui/Icon';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { TextField } from '../../../shared/ui/TextField';
import { colors, space } from '../../../shared/ui/theme';
import { formatTime } from '../../../shared/utils/time';
import { leaseSync } from '../../leases/data/leaseSync';
import { closeSession } from '../../session/data/sessionRepository';

/** Ajustes: dispositivo, sesión abierta (SPEC-003 RF-13) y estado de la sincronización (SPEC-008 RF-16). */
export function SettingsScreen() {
  const session = useSessionStore((s) => s.currentSession);
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession);
  const isOnline = useSessionStore((s) => s.isOnline);
  const eventsSyncedAt = useSessionStore((s) => s.eventsSyncedAt);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const current = await getDeviceIdentity();
    setIdentity(current);
    setName(current.name);
    setSummary(await getSyncSummary());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload().catch((error) => console.error('Error al leer la identidad del dispositivo', error));
    }, [reload])
  );

  // Un envío en segundo plano cambia los contadores aunque la pantalla siga abierta.
  useEffect(() => {
    getSyncSummary().then(setSummary).catch(() => {});
  }, [eventsSyncedAt]);

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
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => run(async () => { await closeSession(); setCurrentSession(null); void leaseSync(); /* SPEC-005 RF-13 */ void syncEvents(); }) },
    ]);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Ajustes" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card title="Este teléfono">
          <TextField label="Nombre" value={name} onChangeText={setName} accessibilityLabel="Nombre del dispositivo" />
          {identity?.registeredAt ? (
            <View style={styles.status}>
              <Icon name="exito" size={18} color={colors.action} strokeWidth={2.5} />
              <AppText style={styles.ok}>Registrado en el servidor</AppText>
            </View>
          ) : (
            <AppText style={styles.pending}>Registro pendiente en el servidor</AppText>
          )}
          <AppText variant="caption" selectable>
            Identificador {identity?.id ?? '…'}
          </AppText>
          <Button label="Guardar nombre" variant="secondary" compact onPress={saveName} disabled={busy || !name.trim() || name.trim() === identity?.name} />
          {identity && !identity.registeredAt && <Button label="Reintentar registro" variant="outline" compact onPress={retryRegistration} disabled={busy} />}
        </Card>

        <Card title="Sesión">
          {session ? (
            <>
              <AppText>
                {session.seller_name}, abierta a las {formatTime(session.opened_at)}
              </AppText>
              <Button label="Cerrar sesión" variant="destructive" compact onPress={confirmClose} disabled={busy} />
            </>
          ) : (
            <AppText variant="caption">No hay sesión abierta. Ábrela desde Venta.</AppText>
          )}
        </Card>

        <Card title="Sincronización">
          <View style={styles.counts}>
            <Count value={summary ? String(summary.pending) : '…'} label="por enviar" />
            <Count value={summary ? String(summary.failed) : '…'} label="con error" />
            <Count value={summary?.syncedAt ? formatTime(summary.syncedAt) : '—'} label="último envío" />
          </View>
          <Button label="Sincronizar ahora" compact onPress={() => run(syncEvents)} disabled={busy || !isOnline} />
        </Card>
      </ScrollView>
    </View>
  );
}

function Count({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.count} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText variant="figure" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 14 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ok: { color: colors.action },
  pending: { color: colors.warningText },
  counts: { flexDirection: 'row', gap: space.sm },
  count: { flex: 1 },
});
