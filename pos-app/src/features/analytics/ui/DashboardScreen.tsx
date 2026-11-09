import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Pill } from '../../../shared/ui/Pill';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, fonts, radius, space } from '../../../shared/ui/theme';
import { formatCents } from '../../../shared/utils/money';
import { formatTime } from '../../../shared/utils/time';
import { getDashboard, type Dashboard } from '../data/analyticsRepository';
import { WINDOW_MINUTES } from '../domain/metrics';

const REFRESH_MS = 15_000; // SPEC-009 P3

const rate = (value: number) => value.toFixed(1).replace('.', ',');
const runoutText = (minutes: number) => (minutes < 1 ? 'menos de 1 min' : minutes < 60 ? `${Math.round(minutes)} min` : `${(minutes / 60).toFixed(1).replace('.', ',')} h`);

/** Panel local: ritmo, qué se agota, totales y más vendidos de la sesión (SPEC-009, SPEC-012 RF-21..RF-23). Funciona sin red. */
export function DashboardScreen() {
  const leasesUpdatedAt = useSessionStore((s) => s.leasesUpdatedAt);
  const [data, setData] = useState<Dashboard | null>(null);
  const loading = useRef(false);

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

  useFocusEffect(
    useCallback(() => {
      reload();
      const timer = setInterval(reload, REFRESH_MS);
      return () => clearInterval(timer);
    }, [reload])
  );
  useEffect(reload, [leasesUpdatedAt, reload]); // cambia tras cada cobro y cuando cambian los préstamos

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Dashboard" />
      {!data ? (
        <AppText style={styles.empty}>Calculando…</AppText>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.hero} accessible accessibilityLabel={`${rate(data.burnRate)} unidades por minuto en los últimos ${WINDOW_MINUTES} minutos`}>
            <Text style={styles.heroLabel}>Ritmo de venta, últimos {WINDOW_MINUTES} min</Text>
            <View style={styles.heroRow}>
              <Text style={styles.heroValue}>{rate(data.burnRate)}</Text>
              <Text style={styles.heroUnit}>unidades por minuto</Text>
            </View>
          </View>

          <AppText variant="heading" style={styles.section} accessibilityRole="header">
            Se agota primero
          </AppText>
          {data.runout.length === 0 && <AppText variant="caption">Sin ventas recientes.</AppText>}
          {data.runout.map((item) => {
            const left = item.soldOut ? 'Agotado' : runoutText(item.minutesLeft);
            return (
              <View key={item.productId} style={styles.row} accessible accessibilityLabel={`${item.name}: ${left}, ${rate(item.ratePerMin)} unidades por minuto`}>
                <AppText variant="strong" style={styles.flex}>
                  {item.name}
                </AppText>
                {!item.soldOut && <AppText variant="caption">{rate(item.ratePerMin)} u/min</AppText>}
                <Pill label={left} tone={item.soldOut ? 'danger' : item.low ? 'alert' : 'neutral'} style={styles.pill} />
              </View>
            );
          })}
          {data.idleLeases > 0 && <AppText variant="caption">{data.idleLeases} productos con préstamo sin ventas recientes</AppText>}

          {!data.session ? (
            <AppText variant="caption" style={styles.section}>
              Todavía no hay sesiones. Abre una desde Venta.
            </AppText>
          ) : (
            <>
              <AppText variant="heading" style={styles.section} accessibilityRole="header">
                {data.session.closed_at ? `Última sesión de ${data.session.seller_name}` : `Sesión de ${data.session.seller_name}`}
              </AppText>
              <AppText variant="caption">
                {data.session.closed_at
                  ? `De ${formatTime(data.session.opened_at)} a ${formatTime(data.session.closed_at)}`
                  : `Abierta desde las ${formatTime(data.session.opened_at)}`}
              </AppText>
              {data.totals && (
                <View style={styles.totals}>
                  <Stat label="Ventas" value={String(data.totals.sales)} />
                  <Stat label="Unidades" value={String(data.totals.units)} />
                  <Stat label="Ingreso" value={formatCents(data.totals.revenueCents)} />
                  <Stat label="Ticket promedio" value={formatCents(data.totals.averageTicketCents)} />
                </View>
              )}
              <AppText variant="heading" style={styles.section} accessibilityRole="header">
                Más vendidos
              </AppText>
              {data.top.length === 0 && <AppText variant="caption">Sin ventas en esta sesión.</AppText>}
              {data.top.map((product, index) => (
                <View
                  key={product.product_id}
                  style={styles.row}
                  accessible
                  accessibilityLabel={`${index + 1}. ${product.name}: ${product.units} unidades, ${formatCents(product.revenue_cents)}`}
                >
                  <Text style={styles.rank}>{index + 1}</Text>
                  <AppText variant="strong" style={styles.flex}>
                    {product.name}
                  </AppText>
                  <AppText variant="caption">{product.units} u</AppText>
                  <AppText variant="figureSmall" style={styles.value}>
                    {formatCents(product.revenue_cents)}
                  </AppText>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="figure" style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 6 },
  flex: { flex: 1 },
  empty: { padding: space.xxl, textAlign: 'center', color: colors.muted },
  hero: { backgroundColor: colors.ink, borderRadius: radius.xl, padding: 18 },
  heroLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.onAction },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
  heroValue: { fontFamily: fonts.displayHeavy, fontSize: 64, lineHeight: 70, color: colors.onAction, fontVariant: ['tabular-nums'] },
  heroUnit: { fontFamily: fonts.displaySemibold, fontSize: 22, color: colors.onAction },
  section: { marginTop: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, borderTopWidth: 1, borderColor: colors.line },
  pill: { alignSelf: 'center' },
  rank: { width: 22, fontFamily: fonts.displayBold, fontSize: 18, color: colors.muted, fontVariant: ['tabular-nums'] },
  value: { minWidth: 84, textAlign: 'right' },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  stat: { flexBasis: '48%', flexGrow: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.surface },
  statValue: { fontSize: 24, lineHeight: 28 },
});
