import Svg, { Path } from 'react-native-svg';
import { colors } from './theme';

// SPEC-012 RF-3: iconos de trazo en una cuadrícula de 24; react-native-svg ya viene por el QR (plan §1).
const PATHS = {
  venta: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6.2M9 20h.01M17 20h.01',
  inventario: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  dashboard: 'M5 20V11M12 20V4M19 20v-6M3 20h18',
  ajustes: 'M4 6h9M17 6h3M15 4v4M4 12h3M11 12h9M9 10v4M4 18h11M19 18h1M17 16v4',
  buscar: 'M18 11a7 7 0 1 1-14 0a7 7 0 1 1 14 0zM20 20l-3.5-3.5',
  actualizar: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  sinRed: 'M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18',
  exito: 'M5 12.5l4.5 4.5L19 7.5',
  telefono: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  conciliar: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
} as const;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Icono decorativo: quien lo usa pone la etiqueta de accesibilidad en el botón o el texto. */
export function Icon({ name, size = 24, color = colors.ink, strokeWidth = 2 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d={PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
