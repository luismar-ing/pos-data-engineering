import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, fonts } from './theme';

type Variant = keyof typeof variants;

/** Texto con las variantes del tema (SPEC-012 RF-2). Las cifras usan números tabulares. */
export function AppText({ variant = 'body', style, ...props }: TextProps & { variant?: Variant }) {
  return <Text {...props} style={[variants[variant], style]} />;
}

const tabular = ['tabular-nums'] as const;

const variants = StyleSheet.create({
  title: { fontFamily: fonts.displayHeavy, fontSize: 34, lineHeight: 38, color: colors.ink },
  heading: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.ink },
  strong: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.muted },
  caption: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18, color: colors.muted, fontVariant: tabular },
  figure: { fontFamily: fonts.displayHeavy, fontSize: 28, lineHeight: 32, color: colors.ink, fontVariant: tabular },
  figureSmall: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 24, color: colors.ink, fontVariant: tabular },
});
