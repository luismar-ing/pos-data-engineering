import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '../store/sessionStore';
import { AppText } from './AppText';
import { space } from './theme';

/**
 * Cabecera de pantalla: título grande, subtítulo y acción a la derecha (SPEC-012 RF-4).
 * Ocupa la zona segura superior salvo sin conexión, cuando la ocupa la franja amarilla (RNF-5).
 */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string | null; right?: ReactNode }) {
  const top = useScreenTopInset();
  return (
    <View style={[styles.header, { paddingTop: top + space.lg }]}>
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

/** Inset superior que le toca a la pantalla: 0 si la franja "Sin conexión" ya lo ocupa. */
export function useScreenTopInset() {
  const { top } = useSafeAreaInsets();
  const isOnline = useSessionStore((s) => s.isOnline);
  return isOnline ? top : 0;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  text: { flex: 1, gap: 4 },
});
