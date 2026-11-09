import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, type IconName } from './Icon';
import { colors, fonts, radius } from './theme';

type Variant = 'primary' | 'secondary' | 'outline' | 'destructive';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** 48 de alto en lugar de 56, para tarjetas y cabeceras. */
  compact?: boolean;
  icon?: IconName;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Botón único de la app (SPEC-012 RF-4). */
export function Button({ label, onPress, variant = 'primary', disabled, compact, icon, accessibilityLabel, style }: Props) {
  const tone = tones[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        tone.box,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {icon && <Icon name={icon} size={compact ? 18 : 20} color={tone.text.color} />}
        <Text style={[styles.label, compact && styles.labelCompact, tone.text]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const tones = {
  primary: StyleSheet.create({ box: { backgroundColor: colors.action }, text: { color: colors.onAction } }),
  secondary: StyleSheet.create({ box: { backgroundColor: colors.surface }, text: { color: colors.ink } }),
  outline: StyleSheet.create({ box: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.lineStrong }, text: { color: colors.ink } }),
  destructive: StyleSheet.create({ box: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.danger }, text: { color: colors.danger } }),
};

const styles = StyleSheet.create({
  base: { minHeight: 56, borderRadius: radius.md, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: 48, borderRadius: radius.sm + 2 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.displayBold, fontSize: 20 },
  labelCompact: { fontSize: 17 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
