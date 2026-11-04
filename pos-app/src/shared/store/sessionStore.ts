import { create } from "zustand";
import type { Session } from "../../features/session/data/sessionRepository";
import { addProduct, changeQuantity, removeLine, type CartLine } from "../../features/sales/domain/cart";

interface SessionState {
    isOnline: boolean;
    /** Sesión de vendedor abierta en este dispositivo (SPEC-003); null si no hay. */
    currentSession: Session | null;
    setCurrentSession: (session: Session | null) => void;
    /** Hora de la última descarga correcta del catálogo (SPEC-004); al cambiar, Inventario recarga. */
    catalogSyncedAt: string | null;
    setCatalogSyncedAt: (syncedAt: string | null) => void;
    /** Último cambio de los préstamos locales (SPEC-005); al cambiar, Venta e Inventario recargan lo disponible. */
    leasesUpdatedAt: string | null;
    setLeasesUpdatedAt: (updatedAt: string) => void;
    /** Último envío correcto de la bitácora (SPEC-008); al cambiar, Ajustes recarga el resumen. */
    eventsSyncedAt: string | null;
    setEventsSyncedAt: (syncedAt: string) => void;
    /** Carrito en memoria (SPEC-007 P3): solo producto y cantidad; el precio sale del catálogo local. */
    cart: CartLine[];
    setOnlineStatus: (status: boolean) => void;
    /** `max`: unidades disponibles en el préstamo (SPEC-005 RF-8). */
    addToCart: (productId: string, max: number) => void;
    changeCartQuantity: (productId: string, delta: number, max: number) => void;
    removeFromCart: (productId: string) => void;
    clearCart: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    isOnline: true,
    currentSession: null,
    setCurrentSession: (session) => set({ currentSession: session }),
    catalogSyncedAt: null,
    setCatalogSyncedAt: (syncedAt) => set({ catalogSyncedAt: syncedAt }),
    leasesUpdatedAt: null,
    setLeasesUpdatedAt: (updatedAt) => set({ leasesUpdatedAt: updatedAt }),
    eventsSyncedAt: null,
    setEventsSyncedAt: (syncedAt) => set({ eventsSyncedAt: syncedAt }),
    cart: [],
    setOnlineStatus: (status) => set({ isOnline: status }),
    addToCart: (productId, max) => set((state) => ({ cart: addProduct(state.cart, productId, max) })),
    changeCartQuantity: (productId, delta, max) => set((state) => ({ cart: changeQuantity(state.cart, productId, delta, max) })),
    removeFromCart: (productId) => set((state) => ({ cart: removeLine(state.cart, productId) })),
    clearCart: () => set({ cart: [] }),
}))
