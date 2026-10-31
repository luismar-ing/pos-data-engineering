import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
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
    } catch (error) {
      Alert.alert('No se pudo abrir la sesión', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Abre una sesión para cobrar</Text>
      <TextInput
        style={styles.input}
        placeholder="Nombre del vendedor"
        value={sellerName}
        onChangeText={setSellerName}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={handleOpen}
        accessibilityLabel="Nombre del vendedor"
      />
      <Button title="Abrir sesión" onPress={handleOpen} disabled={busy || !sellerName.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
});
