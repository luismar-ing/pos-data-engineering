import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import { getAllProducts } from '../../inventory/data/productRepository';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { OpenSessionForm } from '../../session/ui/OpenSessionForm';
import { createSale } from '../data/saleRepository';

/** Venta. Sin sesión abierta no se puede cobrar (SPEC-003 CA-6). El carrito llega con SPEC-007. */
export function SaleScreen() {
  const session = useSessionStore((s) => s.currentSession);
  const [lastSale, setLastSale] = useState<string | null>(null);

  if (!session) return <OpenSessionForm />;

  async function handleTestSale() {
    try {
      // shortcut: vende el primer producto del catálogo; quitar con el carrito de SPEC-007 (TD-023).
      const [product] = await getAllProducts();
      if (!product) {
        Alert.alert('Sin catálogo', 'Actualiza el catálogo desde Inventario con red.');
        return;
      }
      const { sale } = await createSale({
        paymentMethod: 'cash',
        lines: [{ productId: product.id, quantity: 1, unitPriceCents: product.unit_price_cents }],
      });
      setLastSale(`Venta ${sale.id.slice(0, 8)} · sesión ${sale.session_id?.slice(0, 8)}`);
    } catch (error) {
      Alert.alert('No se pudo registrar la venta', error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sesión de {session.seller_name}</Text>
      <Text>Desde {new Date(session.opened_at).toLocaleTimeString()}</Text>
      {__DEV__ && <Button title="Venta de prueba" onPress={handleTestSale} />}
      {lastSale && <Text>{lastSale}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
});
