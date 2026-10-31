import { create } from "zustand";
import type { Session } from "../../features/session/data/sessionRepository";

interface CartItem {
    productId: string;
    quantity: number;
    unitPrice: number;
}

interface SessionState {
    isOnline: boolean;
    /** Sesión de vendedor abierta en este dispositivo (SPEC-003); null si no hay. */
    currentSession: Session | null;
    setCurrentSession: (session: Session | null) => void;
    cart: CartItem[];
    setOnlineStatus: (status: boolean) => void;
    addToCart: (item: CartItem) => void;
    clearCart: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    isOnline: true,
    currentSession: null,
    setCurrentSession: (session) => set({ currentSession: session }),
    cart: [],
    setOnlineStatus: (status) => set({ isOnline: status }),
    addToCart: (item) =>
        // se guardan los valores previos del carrito (con state) y se agrega el nuevo item al final del array
        set((state) => ({cart: [...state.cart, item]})),
    clearCart: () => set({cart: []})
}))