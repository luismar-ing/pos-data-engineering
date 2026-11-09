import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
import { Pill } from '../../../shared/ui/Pill';
import { colors, fonts, radius } from '../../../shared/ui/theme';
import { formatCents } from '../../../shared/utils/money';
import type { Product } from '../../inventory/data/productRepository';

interface Props {
  product: Product;
  /** Lo disponible en el préstamo (SPEC-005). */
  left: number;
  /** Se agota en menos de 5 min a su ritmo (SPEC-012 P2). */
  low: boolean;
  /** Unidades en el carrito. */
  qty: number;
  /** Ancho fijo: con flex, una tarjeta sola en la última fila no medía media columna. */
  width: number;
  onAdd: (productId: string, left: number) => void;
}

/** Tarjeta de producto de Venta (SPEC-012 RF-8..RF-10). Memoizada: la cuadrícula puede tener 2 000 (RNF-2). */
export const ProductTile = memo(function ProductTile({ product, left, low, qty, width, onAdd }: Props) {
  const soldOut = left === 0;
  const price = formatCents(product.unit_price_cents);
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, { width }, qty > 0 && styles.inCart, soldOut && styles.soldOut, pressed && styles.pressed]}
      onPress={() => onAdd(product.id, left)}
      disabled={soldOut}
      accessibilityRole="button"
      accessibilityState={{ disabled: soldOut }}
      accessibilityLabel={
        soldOut
          ? `${product.name}, agotado`
          : `Agregar ${product.name}, ${price}, quedan ${left}${low ? ', se agota pronto' : ''}${qty ? `, ${qty} en el carrito` : ''}`
      }
    >
      <AppText variant="strong" numberOfLines={2} style={styles.name}>
        {product.name}
      </AppText>
      <AppText variant="figure" style={styles.price}>
        {price}
      </AppText>
      <Pill label={soldOut ? 'Agotado' : `Quedan ${left}`} tone={soldOut ? 'danger' : low ? 'warning' : 'action'} />
      {qty > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{qty}</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: {
    minHeight: 124,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'solid', // Android conserva el estilo punteado si no se fija
    borderColor: colors.line,
    backgroundColor: colors.background,
    padding: 14,
    gap: 6,
    justifyContent: 'space-between',
  },
  inCart: { borderColor: colors.action },
  soldOut: { backgroundColor: colors.surface, borderColor: colors.lineStrong, borderStyle: 'dashed' },
  pressed: { backgroundColor: colors.actionTint },
  name: { paddingRight: 30 },
  price: { fontSize: 30, lineHeight: 34 },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 6,
    borderRadius: 15,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.displayHeavy, fontSize: 17, color: colors.onAction, fontVariant: ['tabular-nums'] },
});
