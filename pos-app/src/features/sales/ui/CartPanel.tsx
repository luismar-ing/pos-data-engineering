import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { colors, fonts, radius, TOUCH } from '../../../shared/ui/theme';
import { formatCents } from '../../../shared/utils/money';
import type { PricedCart } from '../domain/cart';

/** Líneas del carrito con − / + y subtotal, dentro de la hoja de cobro (SPEC-007 RF-3..RF-5, SPEC-012 RF-12). */
export function CartPanel({ priced, available }: { priced: PricedCart; available: Map<string, number> }) {
  const changeQuantity = useSessionStore((s) => s.changeCartQuantity);
  const removeFromCart = useSessionStore((s) => s.removeFromCart);

  return (
    <View style={styles.lines}>
      {priced.lines.map((line) => (
        <View key={line.productId} style={styles.line}>
          <View style={styles.flex}>
            <AppText variant="strong" numberOfLines={2}>
              {line.name}
            </AppText>
            <AppText variant="caption">{formatCents(line.unitPriceCents)} c/u</AppText>
          </View>
          <Step label="−" a11y={`Quitar una unidad de ${line.name}`} onPress={() => changeQuantity(line.productId, -1, available.get(line.productId) ?? 0)} />
          <Text style={styles.qty} accessibilityLabel={`${line.quantity} unidades`}>
            {line.quantity}
          </Text>
          <Step label="+" a11y={`Agregar una unidad de ${line.name}`} onPress={() => changeQuantity(line.productId, 1, available.get(line.productId) ?? 0)} />
          <AppText variant="figureSmall" style={styles.subtotal}>
            {formatCents(line.subtotalCents)}
          </AppText>
        </View>
      ))}
      {priced.unavailable.map((line) => (
        <View key={line.productId} style={styles.line}>
          <AppText style={[styles.flex, styles.warning]}>Producto no disponible (× {line.quantity})</AppText>
          <Pressable onPress={() => removeFromCart(line.productId)} style={styles.remove} accessibilityRole="button" accessibilityLabel="Quitar producto no disponible">
            <Text style={styles.removeText}>Quitar</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Step({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.step, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel={a11y}>
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lines: { borderTopWidth: 1, borderColor: colors.line },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line },
  flex: { flex: 1 },
  qty: { minWidth: 26, textAlign: 'center', fontFamily: fonts.displayHeavy, fontSize: 22, color: colors.ink, fontVariant: ['tabular-nums'] },
  subtotal: { minWidth: 78, textAlign: 'right' },
  step: { width: TOUCH, height: TOUCH, borderRadius: radius.sm + 2, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink, lineHeight: 26 },
  pressed: { backgroundColor: colors.surface },
  warning: { color: colors.danger },
  remove: { minHeight: TOUCH, minWidth: TOUCH, justifyContent: 'center', paddingHorizontal: 8 },
  removeText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
});
