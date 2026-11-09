import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '../store/sessionStore';
import { Icon } from './Icon';
import { colors, fonts, space } from './theme';

/** Aviso "Sin conexión" sobre cada pestaña (SPEC-006 RF-6, SPEC-012 RF-26). No se muestra con conexión. */
export function OfflineBanner() {
  const isOnline = useSessionStore((state) => state.isOnline);
  const { top } = useSafeAreaInsets();
  if (isOnline) return null;
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel="Sin conexión. Vendes con lo que tienes prestado."
      style={[styles.banner, { paddingTop: top + 10 }]}
    >
      <Icon name="sinRed" size={22} strokeWidth={2.2} />
      <Text style={styles.text}>Sin conexión. Vendes con lo que tienes prestado.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.warning, paddingHorizontal: space.xl, paddingBottom: 12 },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
