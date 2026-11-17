import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, space } from './theme';

/** Tarjeta de sección (SPEC-012 RF-4). */
export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
      {title && (
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.background, borderRadius: radius.xl, padding: space.lg, gap: 10 },
});
