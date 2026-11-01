import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { formatCents } from '../../../shared/utils/money';
import type { PricedCart } from '../domain/cart';

/** Carrito: líneas con − / +, total, Vaciar y Cobrar (SPEC-007 RF-3..RF-6). */
export function CartPanel({ priced, onCheckout }: { priced: PricedCart; onCheckout: () => void }) {
  const changeQuantity = useSessionStore((s) => s.changeCartQuantity);
  const removeFromCart = useSessionStore((s) => s.removeFromCart);
  const clearCart = useSessionStore((s) => s.clearCart);
  const isEmpty = priced.lines.length === 0 && priced.unavailable.length === 0;

  if (isEmpty) return <Text style={styles.hint}>Toca un producto para agregarlo.</Text>;

  const confirmClear = () =>
    Alert.alert('Vaciar carrito', '¿Quitar todos los productos?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar', style: 'destructive', onPress: clearCart },
    ]);

  return (
    <View style={styles.panel}>
      <ScrollView style={styles.lines}>
        {priced.lines.map((line) => (
          <View key={line.productId} style={styles.line}>
            <View style={styles.flex}>
              <Text style={styles.name}>{line.name}</Text>
              <Text style={styles.muted}>{formatCents(line.unitPriceCents)} c/u</Text>
            </View>
            <SmallButton label="−" a11y={`Quitar una unidad de ${line.name}`} onPress={() => changeQuantity(line.productId, -1)} />
            <Text style={styles.qty} accessibilityLabel={`${line.quantity} unidades`}>{line.quantity}</Text>
            <SmallButton label="+" a11y={`Agregar una unidad de ${line.name}`} onPress={() => changeQuantity(line.productId, 1)} />
            <Text style={styles.subtotal}>{formatCents(line.subtotalCents)}</Text>
          </View>
        ))}
        {priced.unavailable.map((line) => (
          <View key={line.productId} style={styles.line}>
            <Text style={[styles.flex, styles.warning]}>Producto no disponible (× {line.quantity})</Text>
            <SmallButton label="Quitar" a11y="Quitar producto no disponible" onPress={() => removeFromCart(line.productId)} />
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable onPress={confirmClear} style={styles.clear} accessibilityRole="button" accessibilityLabel="Vaciar carrito">
          <Text style={styles.clearText}>Vaciar</Text>
        </Pressable>
        <Text style={styles.total}>Total {formatCents(priced.totalCents)}</Text>
        <Pressable
          onPress={onCheckout}
          disabled={priced.unavailable.length > 0 || priced.lines.length === 0}
          style={({ pressed }) => [styles.checkout, (priced.unavailable.length > 0 || pressed) && styles.dimmed]}
          accessibilityRole="button"
          accessibilityLabel={`Cobrar ${formatCents(priced.totalCents)}`}
          accessibilityState={{ disabled: priced.unavailable.length > 0 }}
        >
          <Text style={styles.checkoutText}>Cobrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SmallButton({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.small} accessibilityRole="button" accessibilityLabel={a11y}>
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hint: { padding: 16, textAlign: 'center', color: '#666', borderTopWidth: 1, borderColor: '#ddd' },
  panel: { borderTopWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  lines: { maxHeight: 220 },
  line: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 4, gap: 8 },
  flex: { flex: 1 },
  name: { fontSize: 15 },
  muted: { color: '#666', fontSize: 13 },
  warning: { color: '#c0392b' },
  qty: { minWidth: 28, textAlign: 'center', fontSize: 16, fontVariant: ['tabular-nums'] },
  subtotal: { minWidth: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  small: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#e8e8e8', paddingHorizontal: 8 },
  smallText: { fontSize: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  clear: { minHeight: 44, justifyContent: 'center' },
  clearText: { color: '#c0392b' },
  total: { flex: 1, textAlign: 'right', fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  checkout: { minHeight: 48, paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#1e7e34', justifyContent: 'center' },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.5 },
});
