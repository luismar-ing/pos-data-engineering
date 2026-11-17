import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { TextField } from '../../../shared/ui/TextField';
import { colors, space } from '../../../shared/ui/theme';
import { adjustStock, createProduct, updateProduct, type StockProduct } from '../data/adminApi';
import { parseProductForm, parseStockDelta } from '../domain/productForm';
import { confirmAction } from './usePanelData';

interface Props {
  /** `null` = alta; con producto = edición, ajuste de stock y activar/desactivar. */
  product: StockProduct | null;
  visible: boolean;
  onClose: () => void;
  /** Tras un cambio aplicado: recargar la lista. */
  onChanged: () => void;
}

const priceText = (cents: number) => (cents / 100).toFixed(2);

/** Alta y edición de producto, ajuste de stock central (SPEC-014 RF-13..RF-16). */
export function ProductFormSheet({ product, visible, onClose, onChanged }: Props) {
  const isOnline = useSessionStore((s) => s.isOnline);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [initialStock, setInitialStock] = useState('');
  const [delta, setDelta] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(product?.name ?? '');
    setCategory(product?.category ?? '');
    setPrice(product ? priceText(product.unit_price_cents) : '');
    setInitialStock('');
    setDelta('');
    setMessage(null);
    // Solo al abrir o al cambiar de producto: una recarga de la lista tras guardar no borra el mensaje.
  }, [visible, product?.product_id]);

  async function run(task: () => Promise<string>) {
    Keyboard.dismiss();
    setBusy(true);
    try {
      const done = await task();
      setMessage({ text: done, error: false });
      onChanged();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const values = parseProductForm({ name, category, price, ...(product ? {} : { initialStock }) });
    if ('error' in values) return setMessage({ text: values.error, error: true });
    if (!product) {
      void run(async () => {
        await createProduct({
          name: values.name,
          unit_price_cents: values.unit_price_cents,
          initial_stock: values.initial_stock!,
          ...(values.category ? { category: values.category } : {}),
        });
        onClose();
        return 'Producto creado';
      });
      return;
    }
    void run(async () => {
      await updateProduct(product.product_id, { name: values.name, category: values.category, unit_price_cents: values.unit_price_cents });
      return 'Guardado. Los teléfonos toman el precio nuevo al actualizar el catálogo';
    });
  }

  function adjust() {
    if (!product) return;
    const value = parseStockDelta(delta);
    if (value === null) return setMessage({ text: 'Escribe un entero distinto de 0, con signo para restar (ej. -5)', error: true });
    void run(async () => {
      const { product: after } = await adjustStock(product.product_id, value);
      setDelta('');
      return `Stock central: ${after.central_stock}`;
    });
  }

  function toggleActive() {
    if (!product) return;
    const active = !product.active;
    const apply = () =>
      void run(async () => {
        await updateProduct(product.product_id, { active });
        onClose();
        return active ? 'Producto reactivado' : 'Producto desactivado';
      });
    if (active) return apply();
    confirmAction(
      'Desactivar producto',
      `${product.name} sale del catálogo de los teléfonos en su próxima actualización y no recibe préstamos nuevos.`,
      'Desactivar',
      apply
    );
  }

  const disabled = busy || !isOnline;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <Pressable style={styles.backdrop} onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <AppText variant="heading" accessibilityRole="header">
                {product ? product.name : 'Nuevo producto'}
              </AppText>
              <TextField label="Nombre" value={name} onChangeText={setName} maxLength={100} />
              <TextField label="Categoría (opcional)" value={category} onChangeText={setCategory} maxLength={50} />
              <TextField label="Precio" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="25.00" />
              {!product && (
                <TextField label="Stock inicial" value={initialStock} onChangeText={setInitialStock} keyboardType="number-pad" placeholder="0" />
              )}
              <Button label={product ? 'Guardar cambios' : 'Crear producto'} onPress={save} disabled={disabled} />

              {product && (
                <>
                  <AppText variant="strong">Stock central: {product.central_stock}</AppText>
                  <AppText variant="caption">Suma o resta unidades. Nunca baja de 0 y no toca lo prestado ({product.leased_active}).</AppText>
                  <TextField label="Ajuste (ej. +20 o -5)" value={delta} onChangeText={setDelta} keyboardType="numbers-and-punctuation" />
                  <Button label="Aplicar ajuste" variant="secondary" onPress={adjust} disabled={disabled} />
                  <Button
                    label={product.active ? 'Desactivar producto' : 'Reactivar producto'}
                    variant={product.active ? 'destructive' : 'outline'}
                    compact
                    onPress={toggleActive}
                    disabled={disabled}
                  />
                </>
              )}
              {message && <AppText style={message.error ? styles.error : undefined}>{message.text}</AppText>}
              {!isOnline && <AppText variant="caption">Sin conexión: el panel necesita red para guardar.</AppText>}
            </ScrollView>
            <View style={styles.footer}>
              <Button label="Cerrar" variant="outline" onPress={onClose} disabled={busy} />
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { maxHeight: '94%', backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: space.md },
  handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center' },
  content: { padding: space.xl, paddingBottom: space.sm, gap: 14 },
  footer: { padding: space.xl, paddingTop: space.sm },
  error: { color: colors.danger },
});
