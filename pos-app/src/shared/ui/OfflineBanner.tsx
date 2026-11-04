import { StyleSheet, Text } from 'react-native';
import { useSessionStore } from '../store/sessionStore';

/** Aviso "Sin conexión" sobre cada pestaña (SPEC-006 RF-6, P3). No se muestra con conexión. */
export function OfflineBanner() {
  const isOnline = useSessionStore((state) => state.isOnline);
  if (isOnline) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.banner}>
      Sin conexión — las ventas se guardan en el teléfono
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b45309',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
