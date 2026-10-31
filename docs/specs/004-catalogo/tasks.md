# SPEC-004 — Tareas

Rama: `spec/004-catalogo` (monorepo).

### pos-backend
- [x] **T1** [backend] `test/catalogo.test.ts`: 200 sin credencial, orden por nombre, producto desactivado ausente, `unit_price_cents` entero — *Verificación:* `npm test` verde (CA-7)

### pos-app
- [x] **T2** [app] `features/inventory/domain/catalog.ts` (`parseCatalog`) + casos en `test/catalog.test.mjs` — *Verificación:* `npm test` verde: forma válida aceptada; no-arreglo, precio negativo/decimal, nombre vacío e id repetido rechazados (CA-6)
- [x] **T3** [app] `features/inventory/data/catalogRepository.ts` (`DEACTIVATE_ALL_SQL`, `UPSERT_PRODUCT_SQL`, `applyCatalog`, `getCatalogSyncedAt`); confirmar `prepareAsync` en la doc de expo-sqlite v58 (depende de T2) — *Verificación:* `npm test` verde con `node:sqlite`: alta, cambio de precio, baja, reactivación, venta previa conserva su precio, rollback si falla a mitad; `tsc` ok
- [x] **T4** [app] `catalogSync.ts` (`syncCatalog`, una en vuelo); `catalogSyncedAt` en el store; `App.tsx` lanza la descarga sin esperar (depende de T3) — *Verificación:* `tsc` ok
- [x] **T5** [app] `InventoryScreen` (lista, hora, botón Actualizar con indicador y aviso de error) en `RootNavigator`; "Venta de prueba" usa el primer producto del catálogo; borrar `insertProduct` (depende de T4) — *Verificación:* `tsc` ok; `npx expo-doctor` sin errores nuevos

### Verificación en dispositivo
- [x] **T6** [app] Probar en el teléfono con Expo Go y el backend en la PC (depende de T1, T5) — *Verificación:* CA-1..CA-5 uno por uno (CA-2 y CA-5 en modo avión; CA-3 y CA-4 cambiando precio y `active` en `posde`); RNF-1 con 2 000 productos temporales (< 1 s), borrados al terminar

### Cierre
- [x] **T7** [docs] `ARCHITECTURE.md` (clave `catalog_synced_at`, flujo de descarga del catálogo); `TECH_DEBT.md` (ajustar TD-023); `PROGRESS.md`, `DEVLOG.md`, README de specs → Done — *Verificación:* CA-1..CA-7 revisados; `tsc --noEmit` sin errores en ambos repos
