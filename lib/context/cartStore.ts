import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface GuestInfo {
  name: string;
  cnic: string;
}

export interface CartItem {
  ticketTypeId: number;
  eventId: number;
  eventName: string;
  ticketName: string;
  price: number;
  quantity: number;
  maxQuantity?: number;
  guestInfo: Record<number, GuestInfo>; // index -> info
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "guestInfo">) => void;
  removeItem: (ticketTypeId: number) => void;
  updateQuantity: (ticketTypeId: number, quantity: number) => void;
  updateGuestInfo: (
    ticketTypeId: number,
    index: number,
    info: Partial<GuestInfo>
  ) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => {
        set((state) => {
          const existingItem = state.items.find(
            (i) => i.ticketTypeId === newItem.ticketTypeId
          );

          if (existingItem) {
            // If item exists, increment quantity (respecting max if provided)
            const newQuantity = existingItem.quantity + newItem.quantity;
            if (
              existingItem.maxQuantity &&
              newQuantity > existingItem.maxQuantity
            ) {
              return state; // Or throw error/toast
            }

            return {
              items: state.items.map((i) =>
                i.ticketTypeId === newItem.ticketTypeId
                  ? { ...i, quantity: newQuantity }
                  : i
              ),
            };
          }

          // New item
          return {
            items: [...state.items, { ...newItem, guestInfo: {} }],
          };
        });
      },

      removeItem: (ticketTypeId) => {
        set((state) => ({
          items: state.items.filter((i) => i.ticketTypeId !== ticketTypeId),
        }));
      },

      updateQuantity: (ticketTypeId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(ticketTypeId);
          return;
        }

        set((state) => ({
          items: state.items.map((i) => {
            if (i.ticketTypeId === ticketTypeId) {
              if (i.maxQuantity && quantity > i.maxQuantity) return i;

              // Prune guest info if quantity decreases
              const newGuestInfo = { ...i.guestInfo };
              Object.keys(newGuestInfo).forEach((key) => {
                if (parseInt(key) >= quantity) {
                  delete newGuestInfo[parseInt(key)];
                }
              });

              return { ...i, quantity, guestInfo: newGuestInfo };
            }
            return i;
          }),
        }));
      },

      updateGuestInfo: (ticketTypeId, index, info) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (i.ticketTypeId === ticketTypeId) {
              const currentInfo = i.guestInfo[index] || { name: "", cnic: "" };
              return {
                ...i,
                guestInfo: {
                  ...i.guestInfo,
                  [index]: { ...currentInfo, ...info },
                },
              };
            }
            return i;
          }),
        }));
      },

      clearCart: () => set({ items: [] }),

      getTotal: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },

      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: "inside-karachi-cart",
      storage: createJSONStorage(() => localStorage),
      // Exclude sensitive PII (CNIC) from localStorage persistence
      partialize: (state) => ({
        ...state,
        items: state.items.map((item) => ({
          ...item,
          guestInfo: Object.fromEntries(
            Object.entries(item.guestInfo).map(([k, v]) => [
              k,
              { ...v, cnic: "" },
            ])
          ),
        })),
      }),
    }
  )
);
