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
    /** Carrito en memoria (SPEC-007 P3): solo producto y cantidad; el precio sale del catálogo local. */
    cart: CartLine[];
    setOnlineStatus: (status: boolean) => void;
    addToCart: (productId: string) => void;
    changeCartQuantity: (productId: string, delta: number) => void;
    removeFromCart: (productId: string) => void;
    clearCart: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    isOnline: true,
    currentSession: null,
    setCurrentSession: (session) => set({ currentSession: session }),
    catalogSyncedAt: null,
    setCatalogSyncedAt: (syncedAt) => set({ catalogSyncedAt: syncedAt }),
    cart: [],
    setOnlineStatus: (status) => set({ isOnline: status }),
    addToCart: (productId) => set((state) => ({ cart: addProduct(state.cart, productId) })),
    changeCartQuantity: (productId, delta) => set((state) => ({ cart: changeQuantity(state.cart, productId, delta) })),
    removeFromCart: (productId) => set((state) => ({ cart: removeLine(state.cart, productId) })),
    clearCart: () => set({ cart: [] }),
}))
