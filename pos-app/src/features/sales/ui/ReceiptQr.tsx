import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { formatCents } from '../../../shared/utils/money';

interface Props {
  text: string;
  saleId: string;
  totalCents: number;
}

/** QR del recibo, grande y sobre blanco, con total e id corto para confirmar la venta (SPEC-010 RF-8). */
export function ReceiptQr({ text, saleId, totalCents }: Props) {
  const { width } = useWindowDimensions();
  const shortId = saleId.slice(0, 8);
  return (
    <View style={styles.wrap}>
      <Text style={styles.total}>{formatCents(totalCents)}</Text>
      <Text style={styles.muted}>Venta {shortId}</Text>
      <View accessible accessibilityRole="image" accessibilityLabel={`Código QR del recibo de la venta ${shortId}`}>
        {/* ECC L: la pantalla no se mancha y deja los módulos más grandes (plan §1). */}
        <QRCode value={text} ecl="L" size={Math.min(width - 48, 360)} quietZone={16} color="#000" backgroundColor="#fff" />
      </View>
      <Text style={styles.muted}>Escanea con la cámara del teléfono</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8 },
  total: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  muted: { color: '#666' },
});
