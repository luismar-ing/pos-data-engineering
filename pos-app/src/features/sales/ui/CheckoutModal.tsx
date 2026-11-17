import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { TextField } from '../../../shared/ui/TextField';
import { colors, fonts, radius, space, TOUCH } from '../../../shared/ui/theme';
import { computeChangeCents, formatCents, parseMoneyToCents } from '../../../shared/utils/money';
import { syncEvents } from '../../../core/sync/syncWorker';
import { leaseSync } from '../../leases/data/leaseSync';
import { getReceiptText } from '../data/receiptRepository';
import { createSale, type Sale } from '../data/saleRepository';
import { PAYMENT_METHODS, type PaymentMethod, type PricedCart } from '../domain/cart';
import { CartPanel } from './CartPanel';
import { ReceiptQr } from './ReceiptQr';

interface Props {
  visible: boolean;
  priced: PricedCart;
  available: Map<string, number>;
  onClose: () => void;
}

type Receipt = { status: 'loading' } | { status: 'ready'; text: string } | { status: 'error'; message: string };

/**
 * Hoja de cobro: carrito, método de pago, cambio en efectivo y confirmación (SPEC-007 RF-6..RF-10),
 * con el recibo QR directo al confirmar (SPEC-010, SPEC-012 RF-12..RF-18, P1, P3).
 */
export function CheckoutModal({ visible, priced, available, onClose }: Props) {
  const clearCart = useSessionStore((s) => s.clearCart);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ sale: Sale; changeCents: number | null } | null>(null);
  const [receipt, setReceipt] = useState<Receipt>({ status: 'loading' });
  const charging = useRef(false);
  const { bottom } = useSafeAreaInsets();

  const totalCents = priced.totalCents;
  const isEmpty = priced.lines.length === 0 && priced.unavailable.length === 0;
  const receivedCents = method === 'cash' && received.trim() ? parseMoneyToCents(received) : null;
  const changeCents = receivedCents === null ? null : computeChangeCents(totalCents, receivedCents);
  const cashInvalid = method === 'cash' && received.trim() !== '' && (changeCents === null || changeCents < 0);
  const canConfirm = method !== null && !cashInvalid && !busy && priced.unavailable.length === 0 && priced.lines.length > 0;

  function close() {
    if (busy) return;
    setMethod(null);
    setReceived('');
    setDone(null);
    setReceipt({ status: 'loading' });
    onClose();
  }

  // Si el carrito queda vacío antes de cobrar (Vaciar o − en la última unidad), la hoja ya no tiene nada que cobrar.
  useEffect(() => {
    if (visible && !done && isEmpty) close();
  });

  const confirmClear = () =>
    Alert.alert('Vaciar carrito', '¿Quitar todos los productos?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar', style: 'destructive', onPress: clearCart },
    ]);

  async function loadReceipt(saleId: string) {
    try {
      setReceipt({ status: 'ready', text: await getReceiptText(saleId) });
    } catch (error) {
      setReceipt({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function confirm() {
    if (charging.current || !method) return;
    charging.current = true;
    setBusy(true);
    let saleId: string | null = null;
    try {
      const started = Date.now();
      const { sale } = await createSale({ paymentMethod: method, lines: useSessionStore.getState().cart });
      if (__DEV__) console.log(`Cobro registrado en ${Date.now() - started} ms`);
      saleId = sale.id;
      setDone({ sale, changeCents: receivedCents === null ? null : computeChangeCents(sale.total_cents, receivedCents) });
      clearCart();
      useSessionStore.getState().setLeasesUpdatedAt(new Date().toISOString()); // la venta gastó cuota
      void leaseSync(); // SPEC-005 P4: renovar si queda poca cuota
      void syncEvents(); // SPEC-008 RF-4: con red, la venta sale de inmediato
    } catch (error) {
      Alert.alert('No se pudo cobrar', error instanceof Error ? error.message : String(error));
    } finally {
      charging.current = false;
      setBusy(false);
    }
    if (saleId) void loadReceipt(saleId); // P3: el QR sale directo, después de registrar la venta
  }

  const methodLabel = (value: string) => PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      {/* "padding" en ambas plataformas: con edge-to-edge (SDK 58) Android no redimensiona la ventana del modal. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Tocar fuera del campo cierra el teclado: el teclado numérico de iOS no trae botón para cerrarlo. */}
        <Pressable style={styles.backdrop} onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {done ? (
                <>
                  <View style={styles.success}>
                    <Icon name="exito" size={34} color={colors.onAction} strokeWidth={3} />
                  </View>
                  <AppText variant="title" style={styles.center} accessibilityRole="header">
                    Venta registrada
                  </AppText>
                  <AppText variant="figure" style={[styles.center, styles.doneTotal]}>
                    {formatCents(done.sale.total_cents)}
                  </AppText>
                  <AppText variant="caption" style={[styles.center, styles.doneMethod]}>
                    {methodLabel(done.sale.payment_method)}
                    {done.changeCents !== null && done.changeCents > 0 ? `, cambio ${formatCents(done.changeCents)}` : ''}
                  </AppText>
                  {receipt.status === 'ready' && <ReceiptQr text={receipt.text} saleId={done.sale.id} />}
                  {receipt.status === 'loading' && <AppText style={[styles.center, styles.muted]}>Generando recibo…</AppText>}
                  {receipt.status === 'error' && (
                    <AppText style={[styles.center, styles.danger]}>No se pudo generar el recibo: {receipt.message}</AppText>
                  )}
                  <AppText variant="caption" style={styles.center} selectable>
                    Venta {done.sale.id.slice(0, 8)}
                  </AppText>
                </>
              ) : (
                <>
                  <View style={styles.totalRow}>
                    <View>
                      <AppText variant="label">Total a cobrar</AppText>
                      <AppText variant="figure" style={styles.total} accessibilityLabel={`Total ${formatCents(totalCents)}`}>
                        {formatCents(totalCents)}
                      </AppText>
                    </View>
                    <Pressable onPress={confirmClear} style={styles.clear} accessibilityRole="button" accessibilityLabel="Vaciar carrito">
                      <Text style={styles.clearText}>Vaciar</Text>
                    </Pressable>
                  </View>
                  <CartPanel priced={priced} available={available} />
                  <AppText variant="label">Método de pago</AppText>
                  <View style={styles.methods} accessibilityRole="radiogroup">
                    {PAYMENT_METHODS.map((m) => {
                      const selected = method === m.value;
                      return (
                        <Pressable
                          key={m.value}
                          onPress={() => setMethod(m.value)}
                          style={[styles.method, selected && styles.methodSelected]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                        >
                          <Text style={[styles.methodText, selected && styles.methodTextSelected]} numberOfLines={1} adjustsFontSizeToFit>
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {method === 'cash' && (
                    <>
                      <TextField
                        label="Monto recibido (opcional)"
                        value={received}
                        onChangeText={setReceived}
                        keyboardType="decimal-pad"
                        placeholder={formatCents(totalCents)}
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        accessibilityLabel="Monto recibido en efectivo"
                        style={styles.cashInput}
                      />
                      {changeCents !== null && changeCents >= 0 && (
                        <View style={styles.change} accessible accessibilityLabel={`Cambio ${formatCents(changeCents)}`}>
                          <Text style={styles.changeLabel}>Cambio</Text>
                          <Text style={styles.changeValue}>{formatCents(changeCents)}</Text>
                        </View>
                      )}
                      {cashInvalid && <AppText style={styles.danger}>El monto no alcanza o no es válido.</AppText>}
                    </>
                  )}
                </>
              )}
            </ScrollView>
            {/* Botones fijos al pie: siempre a mano aunque el carrito o el QR no quepan (RF-15, RF-18). */}
            <View style={[styles.actions, { paddingBottom: Math.max(bottom, space.md) }]}>
              {done ? (
                <Button label="Nueva venta" onPress={close} style={styles.flex} />
              ) : (
                <>
                  <Button label="Cancelar" variant="secondary" onPress={close} disabled={busy} style={styles.flex} />
                  <Button label={busy ? 'Cobrando…' : 'Confirmar cobro'} onPress={confirm} disabled={!canConfirm} style={styles.confirm} />
                </>
              )}
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
  center: { textAlign: 'center' },
  muted: { color: colors.muted },
  danger: { color: colors.danger },
  totalRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  total: { fontSize: 56, lineHeight: 60 },
  clear: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
  methods: { flexDirection: 'row', gap: space.sm },
  method: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  methodSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  methodText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  methodTextSelected: { fontFamily: fonts.bold, color: colors.onAction },
  cashInput: { fontFamily: fonts.displayBold, fontSize: 24, minHeight: 56 },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.actionTint,
  },
  changeLabel: { fontFamily: fonts.semibold, fontSize: 17, color: colors.action },
  changeValue: { fontFamily: fonts.displayHeavy, fontSize: 32, color: colors.action, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: 1, borderColor: colors.line },
  confirm: { flex: 2 },
  success: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: space.sm,
  },
  doneTotal: { fontSize: 52, lineHeight: 56 },
  doneMethod: { fontSize: 16, marginTop: -6 },
});
