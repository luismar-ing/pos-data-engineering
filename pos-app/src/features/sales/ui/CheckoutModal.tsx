import { useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSessionStore } from '../../../shared/store/sessionStore';
import { computeChangeCents, formatCents, parseMoneyToCents } from '../../../shared/utils/money';
import { syncEvents } from '../../../core/sync/syncWorker';
import { leaseSync } from '../../leases/data/leaseSync';
import { getReceiptText } from '../data/receiptRepository';
import { createSale, type Sale } from '../data/saleRepository';
import { PAYMENT_METHODS, type PaymentMethod } from '../domain/cart';
import { ReceiptQr } from './ReceiptQr';

interface Props {
  visible: boolean;
  totalCents: number;
  onClose: () => void;
}

/** Cobro: método de pago, cambio en efectivo y confirmación (SPEC-007 RF-6..RF-10), con recibo QR (SPEC-010). */
export function CheckoutModal({ visible, totalCents, onClose }: Props) {
  const clearCart = useSessionStore((s) => s.clearCart);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  // El cambio se fija al cobrar: luego el carrito se vacía y `totalCents` pasa a 0.
  const [done, setDone] = useState<{ sale: Sale; changeCents: number | null } | null>(null);
  // El estado de React no frena dos toques en el mismo frame; la ref sí (RF-8).
  const charging = useRef(false);
  // Texto del recibo QR de `done`; nulo = se ve la confirmación (SPEC-010 RF-10).
  const [receipt, setReceipt] = useState<string | null>(null);
  const [buildingReceipt, setBuildingReceipt] = useState(false);

  const receivedCents = method === 'cash' && received.trim() ? parseMoneyToCents(received) : null;
  const changeCents = receivedCents === null ? null : computeChangeCents(totalCents, receivedCents);
  const cashInvalid = method === 'cash' && received.trim() !== '' && (changeCents === null || changeCents < 0);
  const canConfirm = method !== null && !cashInvalid && !busy;

  function close() {
    if (busy) return;
    setMethod(null);
    setReceived('');
    setDone(null);
    setReceipt(null);
    onClose();
  }

  async function showReceipt() {
    if (!done || buildingReceipt) return;
    setBuildingReceipt(true);
    try {
      setReceipt(await getReceiptText(done.sale.id));
    } catch (error) {
      // Solo lectura: la venta ya está guardada y no cambia (RF-11).
      Alert.alert('No se pudo generar el recibo', error instanceof Error ? error.message : String(error));
    } finally {
      setBuildingReceipt(false);
    }
  }

  async function confirm() {
    if (charging.current || !method) return;
    charging.current = true;
    setBusy(true);
    try {
      const started = Date.now();
      const { sale } = await createSale({ paymentMethod: method, lines: useSessionStore.getState().cart });
      if (__DEV__) console.log(`Cobro registrado en ${Date.now() - started} ms`);
      setDone({ sale, changeCents: receivedCents === null ? null : computeChangeCents(sale.total_cents, receivedCents) });
      clearCart();
      useSessionStore.getState().setLeasesUpdatedAt(new Date().toISOString()); // la venta gastó cuota
      void leaseSync(); // SPEC-005 P4: renovar si queda poca cuota
      void syncEvents(); // SPEC-008 RF-4: con red, la venta sale de inmediato
    } catch (error) {
      // La transacción hizo rollback: no se guardó nada y el carrito sigue igual (RF-9).
      Alert.alert('No se pudo cobrar', error instanceof Error ? error.message : String(error));
    } finally {
      charging.current = false;
      setBusy(false);
    }
  }

  const methodLabel = (value: string) => PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      {/* "padding" en ambas plataformas: con edge-to-edge (SDK 58) Android no redimensiona la ventana del modal. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
      {/* Tocar fuera del campo cierra el teclado: el teclado numérico de iOS no trae botón para cerrarlo. */}
      <Pressable style={styles.backdrop} onPress={Keyboard.dismiss} accessible={false}>
        <Pressable style={styles.sheet} onPress={Keyboard.dismiss} accessible={false}>
          {done && receipt ? (
            <>
              <ReceiptQr text={receipt} saleId={done.sale.id} totalCents={done.sale.total_cents} />
              <Button label="Volver" onPress={() => setReceipt(null)} />
            </>
          ) : done ? (
            <>
              <Text style={styles.title}>Venta registrada</Text>
              <Text style={styles.big}>{formatCents(done.sale.total_cents)}</Text>
              <Text>
                {methodLabel(done.sale.payment_method)}
                {done.changeCents !== null && done.changeCents > 0 ? ` · cambio ${formatCents(done.changeCents)}` : ''}
              </Text>
              <Text style={styles.muted} selectable>Venta {done.sale.id.slice(0, 8)}</Text>
              <View style={styles.actions}>
                <Button
                  label={buildingReceipt ? 'Generando…' : 'Recibo QR'}
                  onPress={showReceipt}
                  disabled={buildingReceipt}
                  accessibilityLabel="Mostrar recibo QR al cliente"
                />
                <Button label="Nueva venta" onPress={close} primary />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Cobrar {formatCents(totalCents)}</Text>
              <Text style={styles.label}>Método de pago</Text>
              <View style={styles.methods} accessibilityRole="radiogroup">
                {PAYMENT_METHODS.map((m) => (
                  <Pressable
                    key={m.value}
                    onPress={() => setMethod(m.value)}
                    style={[styles.method, method === m.value && styles.methodSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: method === m.value }}
                  >
                    <Text style={method === m.value ? styles.methodTextSelected : undefined}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              {method === 'cash' && (
                <>
                  <Text style={styles.label}>Monto recibido (opcional)</Text>
                  <TextInput
                    style={styles.input}
                    value={received}
                    onChangeText={setReceived}
                    keyboardType="decimal-pad"
                    placeholder={formatCents(totalCents)}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                    accessibilityLabel="Monto recibido en efectivo"
                  />
                  {changeCents !== null && changeCents >= 0 && <Text style={styles.change}>Cambio: {formatCents(changeCents)}</Text>}
                  {cashInvalid && <Text style={styles.warning}>El monto no alcanza o no es válido.</Text>}
                </>
              )}
              <View style={styles.actions}>
                <Button label="Cancelar" onPress={close} disabled={busy} />
                <Button label={busy ? 'Cobrando…' : 'Confirmar'} onPress={confirm} disabled={!canConfirm} primary />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Button({
  label,
  onPress,
  disabled,
  primary,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, primary && styles.primary, disabled && styles.dimmed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={primary ? styles.primaryText : undefined}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', padding: 24, gap: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 20, fontWeight: '600' },
  big: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: '#666', marginTop: 6 },
  muted: { color: '#666' },
  methods: { flexDirection: 'row', gap: 8 },
  method: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
  methodSelected: { backgroundColor: '#1e7e34', borderColor: '#1e7e34' },
  methodTextSelected: { color: '#fff', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 18 },
  change: { fontSize: 18, fontWeight: '600' },
  warning: { color: '#c0392b' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#e8e8e8' },
  primary: { backgroundColor: '#1e7e34' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.5 },
});
