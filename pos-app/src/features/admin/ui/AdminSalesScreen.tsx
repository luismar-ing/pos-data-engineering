import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, space } from '../../../shared/ui/theme';
import { formatCents } from '../../../shared/utils/money';
import { formatTime } from '../../../shared/utils/time';
import { PAYMENT_METHODS } from '../../sales/domain/cart';
import { getSales, type SalesSummary } from '../data/adminApi';
import { todayRange } from '../domain/session';

const methodLabel = (value: string) => PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
const timeOrDash = (iso: string | null) => (iso ? formatTime(iso) : '—');

/** Ventas de hoy de todos los teléfonos (SPEC-013 RF-10..RF-12). Sin red no hay datos (RNF-5). */
export function AdminSalesScreen() {
  const isOnline = useSessionStore((s) => s.isOnline);
  const [data, setData] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await getSales(todayRange(Date.now())));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="Ventas"
        subtitle={data ? `Hoy · datos de las ${formatTime(data.generated_at)}` : 'Hoy'}
        right={<Button label="Actualizar" icon="actualizar" variant="outline" compact onPress={load} disabled={busy || !isOnline} />}
      />
      <ScrollView contentContainerStyle={styles.container}>
        {error && <AppText style={styles.error}>{error}</AppText>}
        {!data && !error && <AppText variant="caption">Cargando…</AppText>}
        {data && (
          <>
            <Card>
              <View style={styles.figures}>
                <Figure value={formatCents(data.totals.revenue_cents)} label="vendido" />
                <Figure value={String(data.totals.sales)} label="ventas" />
                <Figure value={formatCents(data.totals.average_ticket_cents)} label="ticket promedio" />
              </View>
            </Card>

            <Card title="Por teléfono">
              {data.by_device.map((d) => (
                <Row
                  key={d.device_id}
                  title={d.name ?? d.device_id}
                  detail={`Contacto ${timeOrDash(d.last_seen_at)} · sync ${timeOrDash(d.last_sync_at)}`}
                  value={formatCents(d.revenue_cents)}
                  count={d.sales}
                />
              ))}
            </Card>

            <Card title="Por vendedor">
              {data.by_session.length === 0 && <Empty />}
              {data.by_session.map((s) => (
                <Row key={`${s.session_id}-${s.device_id}`} title={s.seller_name ?? 'Sin sesión'} value={formatCents(s.revenue_cents)} count={s.sales} />
              ))}
            </Card>

            <Card title="Por hora">
              {data.by_hour.length === 0 && <Empty />}
              {data.by_hour.map((h) => (
                <Row key={h.hour} title={formatTime(h.hour)} value={formatCents(h.revenue_cents)} count={h.sales} />
              ))}
            </Card>

            <Card title="Por método de pago">
              {data.by_payment_method.length === 0 && <Empty />}
              {data.by_payment_method.map((p) => (
                <Row key={p.payment_method} title={methodLabel(p.payment_method)} value={formatCents(p.revenue_cents)} count={p.sales} />
              ))}
            </Card>

            <Card title="Más vendidos">
              {data.top_products.length === 0 && <Empty />}
              {data.top_products.map((p) => (
                <Row key={p.product_id} title={p.name} detail={`${p.units} u.`} value={formatCents(p.revenue_cents)} />
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText variant="figureSmall" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

function Row({ title, detail, value, count }: { title: string; detail?: string; value: string; count?: number }) {
  return (
    <View style={styles.row} accessible>
      <View style={styles.rowText}>
        <AppText variant="strong" numberOfLines={1}>
          {title}
        </AppText>
        {detail && <AppText variant="caption">{detail}</AppText>}
      </View>
      <View style={styles.rowValue}>
        <AppText variant="figureSmall">{value}</AppText>
        {count !== undefined && <AppText variant="caption">{count === 1 ? '1 venta' : `${count} ventas`}</AppText>}
      </View>
    </View>
  );
}

const Empty = () => <AppText variant="caption">Sin ventas hoy.</AppText>;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 14 },
  error: { color: colors.danger },
  figures: { flexDirection: 'row', gap: space.sm },
  figure: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  rowText: { flex: 1, gap: 2 },
  rowValue: { alignItems: 'flex-end' },
});
