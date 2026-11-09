# SPEC-012 — Plan técnico

## 1. Enfoque

Solo cambia la capa de UI de `pos-app`. Se crea un módulo de tema (colores, tipografía, radios y espacios de la Propuesta A) y un juego pequeño de componentes compartidos en `src/shared/ui/`. Después, cada pantalla se reescribe con esos componentes, sin tocar repositorios, store, sync ni préstamos. Las únicas piezas de lógica nuevas son puras: el filtro por categoría (P4) y la consulta de productos por agotarse (P2), que reutiliza el cálculo de Runout de SPEC-009.

- **Fuentes:** `@expo-google-fonts/barlow` y `@expo-google-fonts/barlow-semi-condensed` cargadas con `useFonts` de `expo-font`. Los `.ttf` van dentro del paquete de la app (`require`), así que funcionan sin red (RNF-3) y también en Expo Go. El plugin de configuración de `expo-font` no sirve en Expo Go (doc v58), por eso se descarta. `App.tsx` ya muestra un indicador mientras abre la BD: también espera a las fuentes, así que no hace falta `expo-splash-screen`. Si una fuente falla, la app sigue con la del sistema.
- **Iconos:** se dibujan con `react-native-svg`, que ya está instalado (lo usa el QR). Un componente `Icon` con unos 10 trazos. No se añade una librería de iconos.
- **Pestañas:** React Navigation 7 con `headerShown: false`; cada pantalla dibuja su cabecera (título grande, como en el diseño). `tabBarIcon`, colores y tipografía vienen del tema.
- **Zona segura:** `screenLayout` aplica el inset superior con `useSafeAreaInsets`. Sin red, la franja amarilla ocupa ese inset; con red, lo ocupa el fondo de la pantalla.

## 2. Trazabilidad

| Requisito | Componente / archivo | Cómo se cumple |
|---|---|---|
| RF-1, RF-2, RF-4 | `shared/ui/theme.ts`, `shared/ui/*` | Tokens únicos y componentes `AppText`, `Button`, `Pill`, `TextField`, `Card`, `ScreenHeader` |
| RF-2, RNF-3 | `App.tsx` | `useFonts` con los `.ttf` empaquetados; indicador hasta que cargan |
| RF-3 | `navigation/RootNavigator.tsx`, `shared/ui/Icon.tsx` | `tabBarIcon` con `Icon`; activa en `colors.action` |
| RF-5, RF-6 | `features/sales/ui/SaleScreen.tsx` | `ScreenHeader` con vendedor, hora y `Pill` de red (`isOnline`) |
| RF-7 | `features/sales/domain/cart.ts`, `features/sales/ui/CategoryFilter.tsx` | `categoriesOf(products)` y `filterProducts(products, query, category)`, puras y probadas |
| RF-8, RF-9, RF-10 | `features/sales/ui/ProductTile.tsx` | `FlatList` con `numColumns={2}`; estados en carrito, agotado y por agotarse |
| RF-10, RF-20, CA-8 | `features/analytics/data/analyticsRepository.ts` | `getRunout(db, nowMs)` sale de `getDashboard`; nuevo `getLowStockIds(nowMs)` lo reutiliza |
| RF-11 | `features/sales/ui/CartBar.tsx` | Barra fija con artículos, total y "Cobrar"; solo con carrito no vacío |
| RF-12..RF-15 | `features/sales/ui/CheckoutModal.tsx`, `CartPanel.tsx` | La hoja incluye las líneas de `CartPanel` (− / +, Vaciar); se cierra sola si el carrito queda vacío antes de cobrar |
| RF-16..RF-18 | `CheckoutModal.tsx`, `ReceiptQr.tsx` | Estado "hecho" con el QR directo (P3); se quita el paso "Recibo QR" |
| RF-19, RF-20 | `features/inventory/ui/InventoryScreen.tsx` | `SectionList` por categoría; "Actualizar" con `disabled={!isOnline}` (P5) |
| RF-21..RF-23 | `features/analytics/ui/DashboardScreen.tsx` | Mismos datos de `getDashboard`; tarjeta de ritmo, pastillas, cuadrícula 2 × 2 |
| RF-24 | `features/settings/ui/SettingsScreen.tsx` | Tres `Card`; mismas acciones |
| RF-25 | `features/session/ui/OpenSessionForm.tsx` | `ScreenHeader`, `TextField` y `Button` |
| RF-26 | `shared/ui/OfflineBanner.tsx` | Franja amarilla con icono y texto nuevo |
| RF-27 | Pantallas | Mismos textos de vacío y error con `AppText` |
| RNF-1 | — | No se tocan `core/`, `*/data/` (salvo la extracción de `getRunout`), el store ni el backend |
| RNF-2 | `ProductTile` | `React.memo`, `keyExtractor` estable y ancho fijo por columna (con `numColumns`, `getItemLayout` no aplica por tarjeta) |
| RNF-4 | `theme.ts`, componentes | Contrastes medidos (WCAG): tinta `#15233B` sobre blanco 15.7:1, azul `#1D4ED8` sobre blanco 6.7:1, gris `#4A5A73` sobre `#F2F5F9` 6.4:1, ámbar oscuro `#8A5A00` sobre `#FFF4D6` 5.4:1, rojo `#B42318` sobre `#FDECEA` 5.8:1, tinta sobre amarillo `#F2A900` 7.8:1; `minHeight: 44`; estados con texto |
| RNF-5 | `screenLayout`, `CheckoutModal` | Insets de zona segura; la hoja ya usa `KeyboardAvoidingView` |
| RNF-6 | Componentes | Precios y cantidades sin `numberOfLines`; los nombres sí se cortan a 2 líneas |

## 3. Cambios por repo

### pos-app
| Archivo | Acción | Detalle |
|---|---|---|
| `package.json` | Modificar | `npx expo install expo-font @expo-google-fonts/barlow @expo-google-fonts/barlow-semi-condensed` |
| `src/shared/ui/theme.ts` | Crear | `colors`, `fonts` (familia por peso), `radius`, `space`; un solo lugar para los hex de la Propuesta A |
| `src/shared/ui/AppText.tsx` | Crear | `Text` con variantes `title`, `heading`, `body`, `label`, `price`, `figure`; números tabulares en las cifras |
| `src/shared/ui/Button.tsx` | Crear | Variantes `primary`, `secondary`, `destructive`; `Pressable`, `minHeight` 56 (48 en `compact`), estados deshabilitado y presionado |
| `src/shared/ui/Pill.tsx` | Crear | Tonos `action`, `warning`, `danger`, `neutral` |
| `src/shared/ui/TextField.tsx` | Crear | `TextInput` con etiqueta visible y borde de foco |
| `src/shared/ui/Card.tsx` | Crear | Superficie con título opcional |
| `src/shared/ui/ScreenHeader.tsx` | Crear | Título grande, subtítulo y acción a la derecha |
| `src/shared/utils/time.ts` | Crear | `formatTime` (hora corta), usado por Venta, Inventario, Dashboard y Ajustes |
| `src/shared/ui/Icon.tsx` | Crear | Trazos SVG: venta, inventario, dashboard, ajustes, buscar, actualizar, sin red, éxito |
| `src/shared/ui/OfflineBanner.tsx` | Modificar | Franja amarilla, icono y texto de RF-26; mantiene `accessibilityRole="alert"` |
| `src/App.tsx` | Modificar | Espera fuentes además de la BD |
| `src/navigation/RootNavigator.tsx` | Modificar | Sin cabecera, iconos, tema e insets en `screenLayout` |
| `src/features/sales/domain/cart.ts` | Modificar | `categoriesOf`, `filterProducts` |
| `src/features/sales/ui/SaleScreen.tsx` | Modificar | Cabecera, buscador, filtros, cuadrícula, `CartBar` |
| `src/features/sales/ui/CategoryFilter.tsx` | Crear | Fila horizontal de opciones; "Todo" primero |
| `src/features/sales/ui/ProductTile.tsx` | Crear | Tarjeta de producto memoizada |
| `src/features/sales/ui/CartBar.tsx` | Crear | Barra de cobro |
| `src/features/sales/ui/CartPanel.tsx` | Modificar | Solo líneas, "Vaciar" y no disponibles; sin total ni botón Cobrar |
| `src/features/sales/ui/CheckoutModal.tsx` | Modificar | Recibe `priced` y `available`; incluye `CartPanel`; QR directo |
| `src/features/sales/ui/ReceiptQr.tsx` | Modificar | Marco y texto de RF-17; mismo contenido |
| `src/features/analytics/data/analyticsRepository.ts` | Modificar | Extrae `getRunout`; añade `getLowStockIds` |
| `src/features/inventory/ui/InventoryScreen.tsx` | Modificar | Grupos por categoría, cifras, por agotarse, P5 |
| `src/features/analytics/ui/DashboardScreen.tsx` | Modificar | Nuevo estilo |
| `src/features/settings/ui/SettingsScreen.tsx` | Modificar | Nuevo estilo |
| `src/features/session/ui/OpenSessionForm.tsx` | Modificar | Nuevo estilo |
| `test/cart.test.mjs` | Modificar | Pruebas de `categoriesOf` y `filterProducts` |

### pos-backend
Sin cambios.

## 4. Modelo de datos y migraciones

Sin cambios. La categoría ya está en `products.category` (migración v1).

## 5. Contratos HTTP

Sin cambios.

## 6. Pruebas
| Tipo | Qué se verifica | Cubre |
|---|---|---|
| Unitaria | `filterProducts` combina categoría y búsqueda; los productos sin categoría solo salen en "Todo"; `categoriesOf` ordena y no repite | CA-2 |
| Unitaria | Las 57 pruebas actuales siguen pasando sin cambios | CA-11, RNF-1 |
| Tipos | `npx tsc --noEmit` | CA-11 |
| Manual (emulador `pos_pixel`) | Cuadrícula, estados de tarjeta, barra, hoja de cobro con cambio y "no alcanza", QR directo, las 4 pestañas, abrir sesión | CA-1, CA-3..CA-6, CA-9, CA-10 |
| Manual (sin red) | Franja en las 4 pestañas, "Actualizar" deshabilitado, cobro posible | CA-7 |
| Manual | Producto por agotarse en amarillo en Venta, Inventario y Dashboard | CA-8 |
| Manual (teléfono) | Tiempo de cobro en el log de desarrollo `Cobro registrado en N ms` < 100 | CA-12 |
| Manual | Letra del sistema al 130 % y pantalla de 360 px | CA-13 |
| Manual | El QR se lee con la cámara de otro teléfono | CA-6 |

## 7. Riesgos y alternativas descartadas

- **Plugin de `expo-font` en la compilación:** descartado; no funciona en Expo Go (doc v58), que es como se prueba la app.
- **Librería de iconos (`@expo/vector-icons`):** descartada; `react-native-svg` ya está instalado y bastan unos 10 trazos.
- **Librería de UI o de estilos (NativeWind, Tamagui):** descartada; el tema es pequeño y `StyleSheet` alcanza. Cambiaría el stack sin ADR.
- **`expo-splash-screen`:** descartado por ahora; el indicador actual de `App.tsx` ya cubre la carga.
- **Riesgo, nombres de familia por peso:** con `useFonts`, cada peso es su propia familia (`Barlow_600SemiBold`); `fontWeight` no cambia la fuente. Mitigación: `theme.fonts` mapea cada peso a su familia y nadie usa `fontWeight` con estas fuentes.
- **Riesgo, carrito oculto (P1):** el vendedor ve menos detalle antes de cobrar. Mitigación: contador en cada tarjeta y artículos y total en la barra.
- **Riesgo, `getLowStockIds` en cada foco de Venta:** son las 2 consultas de Runout que el Dashboard ya corre en < 200 ms con 10 000 ventas (SPEC-009); se ejecuta fuera del render.
- **Riesgo, TD-024:** `npx expo install` puede proponer subir `expo`. Solo se instalan los paquetes nuevos; la subida sigue en TD-024.

## 8. Chequeo de constitución
- [x] Nunca sobrevender: el bloqueo de agotado y el tope por lo disponible no cambian (RF-9, RF-12)
- [x] Offline-first: fuentes e iconos empaquetados; ninguna pantalla depende de la red para dibujarse
- [x] Eventos inmutables: no se toca la bitácora
- [x] Idempotencia: no se toca la sync
- [x] UI fluida: consultas async fuera del render; tarjetas memoizadas
- [x] Contratos documentados: sin contratos nuevos
