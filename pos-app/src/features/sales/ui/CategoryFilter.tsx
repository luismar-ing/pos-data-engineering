import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, space } from '../../../shared/ui/theme';

interface Props {
  categories: string[];
  /** null = "Todo". */
  selected: string | null;
  onSelect: (category: string | null) => void;
}

/** Filtros de categoría de Venta: "Todo" primero (SPEC-012 RF-7). */
export function CategoryFilter({ categories, selected, onSelect }: Props) {
  if (categories.length === 0) return null;
  const options: (string | null)[] = [null, ...categories];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row} accessibilityRole="radiogroup">
      {options.map((category) => {
        const active = category === selected;
        return (
          <Pressable
            key={category ?? '__todo'}
            onPress={() => onSelect(category)}
            style={[styles.chip, active && styles.active]}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={category ? `Filtrar por ${category}` : 'Ver todos los productos'}
          >
            <Text style={[styles.text, active && styles.activeText]}>{category ?? 'Todo'}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { gap: space.sm, paddingHorizontal: space.xl },
  chip: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.background,
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  activeText: { color: colors.onAction },
});
