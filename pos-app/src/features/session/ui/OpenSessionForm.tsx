import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { TextField } from '../../../shared/ui/TextField';
import { colors, space } from '../../../shared/ui/theme';
import { syncEvents } from '../../../core/sync/syncWorker';
import { leaseSync } from '../../leases/data/leaseSync';
import { openSession } from '../data/sessionRepository';

/** Pide el nombre del vendedor y abre la sesión. Funciona sin red (SPEC-003 RF-8). */
export function OpenSessionForm() {
  const setCurrentSession = useSessionStore((s) => s.setCurrentSession);
  const [sellerName, setSellerName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    setBusy(true);
    try {
      setCurrentSession(await openSession(sellerName));
      void leaseSync(); // SPEC-005 RF-9
      void syncEvents(); // SPEC-008: envía session_opened
    } catch (error) {
      Alert.alert('No se pudo abrir la sesión', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Venta" />
      <View style={styles.container}>
        <AppText variant="heading" accessibilityRole="header">
          Abre una sesión para cobrar
        </AppText>
        <AppText variant="caption">Las ventas quedan a tu nombre. No necesitas red.</AppText>
        <TextField
          label="Nombre del vendedor"
          placeholder="Escribe tu nombre"
          value={sellerName}
          onChangeText={setSellerName}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleOpen}
        />
        <Button label={busy ? 'Abriendo…' : 'Abrir sesión'} onPress={handleOpen} disabled={busy || !sellerName.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: 14 },
});
