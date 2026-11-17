import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '../../../shared/ui/theme';
import { formatCents } from '../../../shared/utils/money';
import type { PricedCart } from '../domain/cart';

/** Barra fija con artículos, total y "Cobrar"; abre la hoja de cobro (SPEC-012 RF-11, P1). Sin carrito no se dibuja. */
export function CartBar({ priced, onOpen }: { priced: PricedCart; onOpen: () => void }) {
  const count = [...priced.lines, ...priced.unavailable].reduce((sum, line) => sum + line.quantity, 0);
  if (count === 0) return null;
  const items = count === 1 ? '1 artículo' : `${count} artículos`;
  const total = formatCents(priced.totalCents);
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Cobrar ${total}, ${items}. Abre el carrito`}
      >
        <View>
          <Text style={styles.items}>{items}, ver carrito</Text>
          <Text style={styles.total}>{total}</Text>
        </View>
        <Text style={styles.cta}>Cobrar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: 10, backgroundColor: colors.background },
  bar: {
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.action,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pressed: { opacity: 0.9 },
  items: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onAction },
  total: { fontFamily: fonts.displayHeavy, fontSize: 26, lineHeight: 30, color: colors.onAction, fontVariant: ['tabular-nums'] },
  cta: { fontFamily: fonts.displayHeavy, fontSize: 22, color: colors.onAction },
});
