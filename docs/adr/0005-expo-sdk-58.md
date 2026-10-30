# ADR-0005 — Actualizar la app a Expo SDK 58

- **Estado:** Aceptado
- **Fecha:** 2026-10-30
- **Modifica:** ADR-0002 (versión de Expo y React Native)
- **Spec relacionada:** SPEC-001 (T11, prueba en dispositivo)

## Contexto
Expo Go en el teléfono de desarrollo solo abre proyectos con el SDK más reciente (58). El proyecto estaba en SDK 57 y no hay emulador de Android instalado, así que no se podía probar la app.

## Decisión
Actualizar `pos-app` a Expo SDK 58 (`expo ~58.0.21`, React Native 0.88.1, React 19.3.0, `expo-sqlite ~58.0.14`, `expo-crypto ~58.0.7`) con `npx expo install --fix`.

## Alternativas consideradas
| Alternativa | Pros | Contras |
|---|---|---|
| **Actualizar a SDK 58** | Expo Go del teléfono funciona; la app casi no tiene código, el costo es mínimo | Cambio de versión de React Native (0.86 → 0.88) |
| Quedarse en 57 + emulador Android | Sin cambios de dependencias | Instalar Android Studio; el problema se repite con cada SDK nuevo |
| Quedarse en 57 + development build | Control total de la versión | Más configuración; no aporta al proyecto ahora |

## Consecuencias
- Ninguna API usada cambió: `openDatabaseAsync`, `execAsync`, `getFirstAsync`, `getAllAsync`, `runAsync`, `withExclusiveTransactionAsync`, `PRAGMA user_version` y `randomUUID` siguen iguales en SDK 58. El único cambio de `expo-sqlite` es que se retira libSQL, que no se usa.
- Verificado: `tsc --noEmit` ok, `expo-doctor` 20/20, bundle de Android generado.
- React Native 0.88 usa por defecto la API estricta de TypeScript: no se pueden importar rutas internas `react-native/Libraries/*`.
- Política: mantener la app en el SDK que soporte Expo Go mientras no haya development build propio.
- Documentación de referencia para la app: https://docs.expo.dev/versions/v58.0.0/
