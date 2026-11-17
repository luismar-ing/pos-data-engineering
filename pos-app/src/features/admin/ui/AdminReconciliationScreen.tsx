import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Pill, type PillTone } from '../../../shared/ui/Pill';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, space } from '../../../shared/ui/theme';
import { formatTime } from '../../../shared/utils/time';
import { getReconciliation, type Reconciliation, type ReconciliationResult } from '../data/adminApi';
import { todayRange } from '../domain/session';
import { usePanelData } from './usePanelData';

const RESULT: Record<ReconciliationResult, { label: string; tone: PillTone }> = {
  cuadra: { label: 'Cuadra', tone: 'action' },
  faltan_ventas: { label: 'Faltan ventas', tone: 'danger' },
  sobran_ventas: { label: 'Sobran ventas', tone: 'warning' },
};

type LeaseLine = Reconciliation['leases'][number];

/** Préstamos cerrados hoy: informado contra sincronizado (SPEC-014 RF-10..RF-12). */
export function AdminReconciliationScreen() {
  const isOnline = useSessionStore((s) => s.isOnline);
  const fetchToday = useCallback(() => getReconciliation(todayRange(Date.now())), []);
  const { data, error, busy, load } = usePanelData(fetchToday);

  const wrong = data?.leases.filter((l) => l.result !== 'cuadra') ?? [];
  const ok = data?.leases.filter((l) => l.result === 'cuadra') ?? [];
  const afterRevoke = data?.leases.filter((l) => l.returned_extra > 0) ?? [];

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Conciliación"
        subtitle={data ? `Hoy · ${wrong.length === 0 ? 'todo cuadra' : `${wrong.length} no cuadra${wrong.length === 1 ? '' : 'n'}`} · datos de las ${formatTime(data.generated_at)}` : null}
        right={<Button label="Actualizar" icon="actualizar" variant="outline" compact onPress={load} disabled={busy || !isOnline} />}
      />
      {error && <AppText style={styles.error}>{error}</AppText>}
      {!data && !error && <AppText style={styles.loading} variant="caption">Cargando…</AppText>}
      {data && (
        <ScrollView contentContainerStyle={styles.container}>
          <Card title={`No cuadran (${wrong.length})`}>
            {wrong.length === 0 ? <AppText variant="caption">Ningún préstamo con diferencias.</AppText> : wrong.map((l) => <LeaseRow key={l.lease_id} lease={l} />)}
          </Card>
          {afterRevoke.length > 0 && (
            <Card title="Ventas posteriores a una baja">
              <AppText variant="caption">Llegaron después de que el servidor devolvió la cuota: esas unidades volvieron de más al stock central.</AppText>
              {afterRevoke.map((l) => (
                <View key={l.lease_id} style={styles.line}>
                  <AppText style={styles.name} numberOfLines={1}>
                    {l.product_name} · {l.device_name ?? l.device_id}
                  </AppText>
                  <AppText variant="strong">{l.returned_extra} de más</AppText>
                </View>
              ))}
            </Card>
          )}
          {data.unassigned.length > 0 && (
            <Card title="Sin préstamo asignado">
              <AppText variant="caption">Ventas anteriores a este cambio: no se pueden comparar con un préstamo.</AppText>
              {data.unassigned.map((u) => (
                <View key={`${u.device_id}:${u.product_id}`} style={styles.line}>
                  <AppText style={styles.name} numberOfLines={1}>
                    {u.product_name} · {u.device_name ?? u.device_id}
                  </AppText>
                  <AppText variant="strong">{u.units}</AppText>
                </View>
              ))}
            </Card>
          )}
          <Card title={`Cuadran (${ok.length})`}>
            {ok.length === 0 ? <AppText variant="caption">Sin préstamos cerrados hoy.</AppText> : ok.map((l) => <LeaseRow key={l.lease_id} lease={l} />)}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

function LeaseRow({ lease: l }: { lease: LeaseLine }) {
  const result = RESULT[l.result];
  return (
    <View style={styles.lease} accessible>
      <View style={styles.line}>
        <AppText variant="strong" style={styles.name} numberOfLines={1}>
          {l.product_name}
        </AppText>
        <Pill label={result.label} tone={result.tone} />
      </View>
      <AppText variant="caption">
        {l.device_name ?? l.device_id} · cerrado {formatTime(l.closed_at)}
        {l.status === 'expired' ? ' por baja' : ''} · informado {l.reported} · sincronizado {l.synced}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 14 },
  error: { color: colors.danger, paddingHorizontal: space.xl },
  loading: { paddingHorizontal: space.xl },
  lease: { gap: space.xs, paddingVertical: space.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flex: 1 },
});
