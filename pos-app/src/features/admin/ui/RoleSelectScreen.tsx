import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { colors, space } from '../../../shared/ui/theme';
import { applyRole } from '../data/roleRepository';
import type { Role } from '../domain/role';

/** Selección de rol al abrir la app sin uno guardado (SPEC-013 RF-1). */
export function RoleSelectScreen() {
  const [busy, setBusy] = useState(false);

  async function choose(role: Role) {
    setBusy(true);
    try {
      await applyRole(role);
    } catch (error) {
      Alert.alert('No se pudo guardar el rol', error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="¿Quién usa la app?" />
      <View style={styles.container}>
        <Card>
          <AppText variant="heading">Vendedor</AppText>
          <AppText variant="caption">Cobra con o sin red. No pide contraseña.</AppText>
          <Button label="Entrar como vendedor" icon="venta" onPress={() => choose('seller')} disabled={busy} />
        </Card>
        <Card>
          <AppText variant="heading">Administrador</AppText>
          <AppText variant="caption">Ventas y stock de todos los teléfonos. Pide usuario y contraseña, y necesita red.</AppText>
          <Button label="Entrar como administrador" icon="ajustes" variant="outline" onPress={() => choose('admin')} disabled={busy} />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  container: { paddingHorizontal: space.xl, gap: 14 },
});
