import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from './theme';

/** Campo de texto con etiqueta visible y borde de foco (SPEC-012 RF-4). */
export function TextField({ label, style, onFocus, onBlur, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.focused, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  input: {
    minHeight: 52,
    borderRadius: radius.md - 2,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.ink,
  },
  focused: { borderColor: colors.action },
});
