import { StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { AppText } from '../../../shared/ui/AppText';
import { colors, radius } from '../../../shared/ui/theme';

/** QR del recibo dentro de un marco, con la explicación para el cliente (SPEC-010 RF-8, SPEC-012 RF-17). */
export function ReceiptQr({ text, saleId }: { text: string; saleId: string }) {
  const { width } = useWindowDimensions();
  const shortId = saleId.slice(0, 8);
  return (
    <View style={styles.wrap}>
      <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={`Código QR del recibo de la venta ${shortId}`}>
        {/* ECC L: la pantalla no se mancha y deja los módulos más grandes (SPEC-010 plan §1). */}
        <QRCode value={text} ecl="L" size={Math.min(width - 140, 260)} quietZone={8} color="#000" backgroundColor="#fff" />
      </View>
      <AppText variant="caption" style={styles.hint}>
        El cliente lo escanea con la cámara de su teléfono. No necesita red.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  frame: { padding: 14, borderRadius: radius.xl, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff' },
  hint: { textAlign: 'center', maxWidth: 280, fontSize: 15, lineHeight: 21 },
});
