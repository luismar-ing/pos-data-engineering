import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { OfflineBanner } from '../../../shared/ui/OfflineBanner';
import { ScreenHeader } from '../../../shared/ui/ScreenHeader';
import { TextField } from '../../../shared/ui/TextField';
import { colors, space } from '../../../shared/ui/theme';
import { login } from '../data/adminApi';
import { applyRole } from '../data/roleRepository';

/** Login del administrador (SPEC-013 RF-5, RF-6). Necesita red. */
export function AdminLoginScreen() {
  const isOnline = useSessionStore((s) => s.isOnline);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setError(null);
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (e) {
      // El servidor ya da un mensaje genérico (RF-6); sin red, el de apiFetch.
      setError(e instanceof Error ? e.message : String(e));
      setPassword('');
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <OfflineBanner />
      <ScreenHeader title="Administrador" subtitle="Entra con tu usuario y contraseña" />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextField label="Usuario" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} autoComplete="username" />
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          returnKeyType="go"
          onSubmitEditing={() => isOnline && username.trim() && password && handleLogin()}
        />
        {error && (
          <AppText style={styles.error} accessibilityRole="alert">
            {error}
          </AppText>
        )}
        {!isOnline && <AppText style={styles.offline}>El login necesita conexión.</AppText>}
        <Button label={busy ? 'Entrando…' : 'Entrar'} onPress={handleLogin} disabled={busy || !isOnline || !username.trim() || !password} />
        <Button label="Cambiar de rol" variant="outline" compact onPress={() => void applyRole(null)} disabled={busy} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xxl, gap: 14 },
  error: { color: colors.danger },
  offline: { color: colors.warningText },
});
