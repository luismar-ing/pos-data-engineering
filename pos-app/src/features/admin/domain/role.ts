// SPEC-013: rol con que se usa la app. Puro, sin Expo: test/admin.test.mjs lo prueba con node.

export type Role = 'seller' | 'admin';

/** Lo guardado en `settings` puede no ser un rol válido; entonces se vuelve a elegir (RF-1). */
export const isRole = (value: string | null | undefined): value is Role => value === 'seller' || value === 'admin';

/** RF-4: con una sesión de vendedor abierta no se cambia de rol. */
export const canSwitchRole = (sellerSessionOpen: boolean): boolean => !sellerSessionOpen;
