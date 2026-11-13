import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, space } from '../../../shared/ui/theme';
import { formatTime } from '../../../shared/utils/time';
import { logout } from '../data/adminApi';
import { applyRole } from '../data/roleRepository';

/** Cuenta del administrador: cerrar sesión y cambiar de rol (SPEC-013 RF-3, RF-8). */
export function AdminAccountScreen() {
  const session = useSessionStore((s) => s.adminSession);
  const [busy, setBusy] = useState(false);

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
      <View style={styles.container}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { paddingHorizontal: space.xl, gap: 14 },
});
