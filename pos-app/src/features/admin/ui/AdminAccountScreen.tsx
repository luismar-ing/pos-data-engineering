import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, space } from '../../../shared/ui/theme';
import { formatTime } from '../../../shared/utils/time';
import { getAudit, logout, type AuditEntry } from '../data/adminApi';
import { applyRole } from '../data/roleRepository';
import { usePanelData } from './usePanelData';

const ACTION: Record<AuditEntry['action'], string> = {
  device_revoke: 'Dio de baja',
  device_reactivate: 'Reactivó',
  product_create: 'Creó',
  product_update: 'Editó',
  stock_adjust: 'Ajustó stock de',
};

/** "Ajustó stock de Hot dog: 3 → 23"; para dispositivos, su nombre. */
function describe(e: AuditEntry): string {
  const after = e.after as { name?: string | null; central_stock?: number };
  const before = e.before as { central_stock?: number } | null;
  const what = after.name ?? e.entity_id;
  if (e.action === 'stock_adjust') return `${ACTION[e.action]} ${what}: ${before?.central_stock ?? '—'} → ${after.central_stock}`;
  return `${ACTION[e.action]} ${what}`;
}

/** Cuenta del administrador: cerrar sesión, cambiar de rol (SPEC-013 RF-3, RF-8) y registro de cambios (SPEC-014 RF-18). */
export function AdminAccountScreen() {
  const session = useSessionStore((s) => s.adminSession);
  const [busy, setBusy] = useState(false);
  const audit = usePanelData(getAudit);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Cuenta" />
      <ScrollView contentContainerStyle={styles.container}>
        <Card title="Sesión de administrador">
          <AppText>{session?.username}</AppText>
          <AppText variant="caption">Vence a las {session ? formatTime(session.expires_at) : '—'}</AppText>
          <Button label="Cerrar sesión" variant="destructive" compact onPress={() => run(logout)} disabled={busy} />
        </Card>
        <Card title="Rol">
          <AppText variant="caption">Cambiar de rol cierra la sesión de administrador.</AppText>
          <Button
            label="Cambiar de rol"
            variant="outline"
            compact
            onPress={() =>
              run(async () => {
                await logout();
                await applyRole(null);
              })
            }
            disabled={busy}
          />
        </Card>
        <Card title="Registro de cambios">
          {audit.error && <AppText style={styles.error}>{audit.error}</AppText>}
          {audit.data?.entries.length === 0 && <AppText variant="caption">Sin cambios todavía.</AppText>}
          {audit.data?.entries.map((e) => (
            <View key={e.request_id} style={styles.entry} accessible>
              <AppText>{describe(e)}</AppText>
              <AppText variant="caption">
                {e.username} · {formatTime(e.created_at)}
              </AppText>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: 14 },
  entry: { gap: 2 },
  error: { color: colors.danger },
});
