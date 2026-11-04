import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { formatCents } from '../../../shared/utils/money';
import { getDashboard, type Dashboard } from '../data/analyticsRepository';
import { WINDOW_MINUTES } from '../domain/metrics';

const REFRESH_MS = 15_000; // P3

const rate = (value: number) => value.toFixed(1).replace('.', ',');
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const runoutText = (minutes: number) => (minutes < 1 ? 'menos de 1 min' : minutes < 60 ? `${Math.round(minutes)} min` : `${(minutes / 60).toFixed(1).replace('.', ',')} h`);

/** Panel local: ritmo, qué se agota, más vendidos y totales de la sesión (SPEC-009). Funciona sin red. */
export function DashboardScreen() {
  const leasesUpdatedAt = useSessionStore((s) => s.leasesUpdatedAt);
  const [data, setData] = useState<Dashboard | null>(null);
  const loading = useRef(false);

  // RNF-1: una consulta a la vez; si llega otra mientras corre, se ignora.
  const reload = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    getDashboard(Date.now())
      .then(setData)
      .catch((error) => console.error('Error al calcular el panel', error))
      .finally(() => {
        loading.current = false;
      });
  }, []);

  // RF-10: al enfocar y cada 15 s mientras está visible.
  useFocusEffect(
    useCallback(() => {
      reload();
      const timer = setInterval(reload, REFRESH_MS);
      return () => clearInterval(timer);
    }, [reload])
  );
  useEffect(reload, [leasesUpdatedAt, reload]); // cambia tras cada cobro y cuando cambian los préstamos

  if (!data) return <Text style={styles.empty}>Calculando…</Text>;

  const { session, totals } = data;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Ritmo</Text>
      <Text style={styles.big} accessibilityLabel={`${rate(data.burnRate)} unidades por minuto en los últimos ${WINDOW_MINUTES} minutos`}>
        {rate(data.burnRate)} u/min
      </Text>
      <Text style={styles.muted}>Últimos {WINDOW_MINUTES} min</Text>

      <Text style={styles.section}>Se agota</Text>
      {data.runout.length === 0 && <Text style={styles.muted}>Sin ventas recientes.</Text>}
      {data.runout.map((item) => {
        const left = item.soldOut ? 'Agotado' : runoutText(item.minutesLeft);
        return (
          <View key={item.productId} style={styles.row} accessibilityLabel={`${item.name}: ${left}, ${rate(item.ratePerMin)} unidades por minuto`}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.muted}>{rate(item.ratePerMin)} u/min</Text>
            <Text style={[styles.value, (item.soldOut || item.low) && styles.warning]}>{left}</Text>
          </View>
        );
      })}
      {data.idleLeases > 0 && <Text style={styles.muted}>{data.idleLeases} productos con préstamo sin ventas recientes</Text>}

      <Text style={styles.section}>Sesión</Text>
      {!session ? (
        <Text style={styles.muted}>Todavía no hay sesiones. Abre una desde Venta.</Text>
      ) : (
        <>
          <Text style={styles.muted}>
            {session.closed_at
              ? `Última sesión: ${session.seller_name}, ${time(session.opened_at)}–${time(session.closed_at)}`
              : `Sesión de ${session.seller_name} (abierta desde ${time(session.opened_at)})`}
          </Text>
          {totals && (
            <View style={styles.totals}>
              <Stat label="Ventas" value={String(totals.sales)} />
              <Stat label="Unidades" value={String(totals.units)} />
              <Stat label="Ingreso" value={formatCents(totals.revenueCents)} />
              <Stat label="Ticket promedio" value={formatCents(totals.averageTicketCents)} />
            </View>
          )}

          <Text style={styles.section}>Más vendidos</Text>
          {data.top.length === 0 && <Text style={styles.muted}>Sin ventas en esta sesión.</Text>}
          {data.top.map((product, index) => (
            <View
              key={product.product_id}
              style={styles.row}
              accessibilityLabel={`${index + 1}. ${product.name}: ${product.units} unidades, ${formatCents(product.revenue_cents)}`}
            >
              <Text style={styles.name}>{`${index + 1}. ${product.name}`}</Text>
              <Text style={styles.muted}>{product.units} u</Text>
              <Text style={styles.value}>{formatCents(product.revenue_cents)}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 6 },
  empty: { padding: 24, textAlign: 'center', color: '#666' },
  section: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  big: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  muted: { color: '#666' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40, borderTopWidth: 1, borderColor: '#eee' },
  name: { flex: 1, fontSize: 16 },
  value: { fontSize: 16, minWidth: 80, textAlign: 'right', fontVariant: ['tabular-nums'] },
  warning: { color: '#b45309', fontWeight: '600' },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  stat: { minWidth: '45%', padding: 8, borderWidth: 1, borderColor: '#eee', borderRadius: 8 },
  statValue: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
