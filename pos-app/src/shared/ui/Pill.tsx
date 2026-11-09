import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from './theme';

export type PillTone = 'action' | 'warning' | 'alert' | 'danger' | 'neutral';

/** Pastilla de estado (SPEC-012 RF-4). El texto dice el estado; el color solo lo refuerza (RNF-4). */
export function Pill({ label, tone = 'neutral', dot, style }: { label: string; tone?: PillTone; dot?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }, style]}>
      {dot && <View style={[styles.dot, { backgroundColor: t.fg }]} />}
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const tones: Record<PillTone, { bg: string; fg: string }> = {
  action: { bg: colors.actionTint, fg: colors.action },
  warning: { bg: colors.warningTint, fg: colors.warningText },
  alert: { bg: colors.warning, fg: colors.ink }, // "se agota pronto" en el Dashboard
  danger: { bg: colors.dangerTint, fg: colors.danger },
  neutral: { bg: colors.surface, fg: colors.ink },
};

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] },
});
