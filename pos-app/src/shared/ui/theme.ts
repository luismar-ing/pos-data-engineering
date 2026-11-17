// SPEC-012: tokens de la Propuesta A "Señalética de feria". Único lugar con los colores y fuentes de la app.

export const colors = {
  ink: '#15233B', // texto
  muted: '#4A5A73', // texto secundario (7:1 sobre blanco)
  line: '#E1E6EE',
  lineStrong: '#D5DCE6',
  surface: '#F2F5F9',
  background: '#FFFFFF',
  action: '#1D4ED8',
  actionTint: '#E8EEFD',
  onAction: '#FFFFFF',
  warning: '#F2A900', // sin conexión y "se agota pronto"; siempre con texto ink encima
  warningTint: '#FFF4D6',
  warningText: '#8A5A00',
  danger: '#B42318', // agotado y acciones destructivas
  dangerTint: '#FDECEA',
  scrim: 'rgba(21, 35, 59, 0.55)',
} as const;

// Con useFonts cada peso es su propia familia: con estas fuentes no se usa fontWeight (plan §7).
export const fonts = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
  displaySemibold: 'BarlowSemiCondensed_600SemiBold',
  displayBold: 'BarlowSemiCondensed_700Bold',
  displayHeavy: 'BarlowSemiCondensed_800ExtraBold',
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 20, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

/** Zona táctil mínima (RNF-4). */
export const TOUCH = 44;
