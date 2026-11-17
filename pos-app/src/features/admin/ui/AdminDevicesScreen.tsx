import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Pill } from '../../../shared/ui/Pill';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, radius, space } from '../../../shared/ui/theme';
import { formatTime } from '../../../shared/utils/time';
import { getDevices, setDeviceRevoked, type AdminDevice } from '../data/adminApi';
import { confirmAction, usePanelData } from './usePanelData';

const time = (iso: string | null) => (iso ? formatTime(iso) : '—');

/** Teléfonos, sus préstamos, baja y reactivación (SPEC-014 RF-1, RF-2, RF-7). */
export function AdminDevicesScreen() {
  const isOnline = useSessionStore((s) => s.isOnline);
  const { data, error, busy, load } = usePanelData(getDevices);
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function apply(device: AdminDevice, revoke: boolean) {
    setActing(device.id);
    try {
      await setDeviceRevoked(device.id, revoke);
      setActionError(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  }

  function ask(device: AdminDevice) {
    const name = device.name ?? device.id;
    if (device.revoked_at) {
      confirmAction('Reactivar teléfono', `${name} vuelve a recibir préstamos.`, 'Reactivar', () => void apply(device, false));
    } else {
      confirmAction(
        'Dar de baja',
        `${name} no recibirá préstamos nuevos. Lo que tiene prestado vuelve al stock central 32 minutos después de que venza cada préstamo, cuando ese teléfono ya no puede venderlo sin red.`,
        'Dar de baja',
        () => void apply(device, true)
      );
    }
  }

  const devices = data?.devices ?? [];
  const revoked = devices.filter((d) => d.revoked_at).length;

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Teléfonos"
        subtitle={data ? `${devices.length} registrados${revoked ? ` · ${revoked} de baja` : ''} · datos de las ${formatTime(data.generated_at)}` : null}
        right={<Button label="Actualizar" icon="actualizar" variant="outline" compact onPress={load} disabled={busy || !isOnline} />}
      />
      {(error ?? actionError) && <AppText style={styles.error}>{error ?? actionError}</AppText>}
      {!data && !error && <AppText style={styles.loading} variant="caption">Cargando…</AppText>}
      <FlatList
        data={devices}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <DeviceRow device={item} onAction={() => ask(item)} disabled={!isOnline || acting !== null} />
        )}
      />
    </View>
  );
}

function DeviceRow({ device: d, onAction, disabled }: { device: AdminDevice; onAction: () => void; disabled: boolean }) {
  return (
    <View style={[styles.row, d.revoked_at && styles.rowRevoked]} accessible={false}>
      <View style={styles.rowHead}>
        <AppText variant="strong" style={styles.name} numberOfLines={1}>
          {d.name ?? d.id}
        </AppText>
        <Pill label={d.revoked_at ? `De baja desde ${formatTime(d.revoked_at)}` : 'Activo'} tone={d.revoked_at ? 'danger' : 'action'} />
      </View>
      <AppText variant="caption">
        Contacto {time(d.last_seen_at)} · sync {time(d.last_sync_at)}
      </AppText>
      <AppText variant="caption">
        {d.open_session ? `Sesión de ${d.open_session.seller_name} desde ${formatTime(d.open_session.opened_at)}` : 'Sin sesión abierta'}
      </AppText>
      {d.leases.length === 0 ? (
        <AppText variant="caption">Sin préstamos activos</AppText>
      ) : (
        d.leases.map((l) => (
          <View key={l.id} style={styles.lease}>
            <AppText style={styles.name} numberOfLines={1}>
              {l.product_name}
            </AppText>
            <AppText variant="caption">
              {l.quota_total} prestados{l.release_at ? ` · vuelven a las ${formatTime(l.release_at)}` : ''}
            </AppText>
          </View>
        ))
      )}
      <Button
        label={d.revoked_at ? 'Reactivar' : 'Dar de baja'}
        variant={d.revoked_at ? 'outline' : 'destructive'}
        compact
        onPress={onAction}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  list: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 10 },
  error: { color: colors.danger, paddingHorizontal: space.xl },
  loading: { paddingHorizontal: space.xl },
  row: { backgroundColor: colors.background, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  rowRevoked: { borderWidth: 2, borderColor: colors.danger },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1 },
  lease: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
