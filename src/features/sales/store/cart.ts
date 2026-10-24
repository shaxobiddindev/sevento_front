/**
 * Kassa savati. sessionStorage da (sahifa yangilansa yo'qolmasin; token emas — sir yo'q).
 * Valyuta yoki narx turi o'zgarsa savat tozalanadi (narxlar shu kontekstga bog'liq).
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { Customer, PosProduct } from '@/shared/api/types'

export interface CartLine {
  product: PosProduct
  quantity: string
  discount: string
}

interface CartState {
  branchId: number | null
  currency: string
  priceTypeId: number | null
  lines: CartLine[]
  /** nasiya uchun mijoz (to'liq to'lovda ham tarix uchun) */
  customer: Customer | null
  setCustomer: (customer: Customer | null) => void
  setContext: (ctx: {
    branchId: number | null
    currency: string
    priceTypeId: number | null
  }) => void
  add: (product: PosProduct, quantity?: string) => void
  setQuantity: (productId: number, quantity: string) => void
  setDiscount: (productId: number, discount: string) => void
  remove: (productId: number) => void
  refreshProducts: (products: PosProduct[]) => void
  clear: () => void
}

function addQuantity(current: string, delta: string): string {
  const sum = Number(current.replace(',', '.')) + Number(delta.replace(',', '.'))
  return String(Math.round(sum * 1000) / 1000)
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      branchId: null,
      currency: '',
      priceTypeId: null,
      lines: [],
      customer: null,
      setCustomer: (customer) => set({ customer }),
      setContext: (ctx) =>
        set((state) => {
          const changed =
            state.branchId !== ctx.branchId ||
            state.currency !== ctx.currency ||
            state.priceTypeId !== ctx.priceTypeId
          return changed ? { ...ctx, lines: [], customer: null } : state
        }),
      add: (product, quantity = '1') =>
        set((state) => {
          const existing = state.lines.find((l) => l.product.id === product.id)
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.product.id === product.id
                  ? { ...l, product, quantity: addQuantity(l.quantity, quantity) }
                  : l,
              ),
            }
          }
          return { lines: [...state.lines, { product, quantity, discount: '' }] }
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l)),
        })),
      setDiscount: (productId, discount) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.product.id === productId ? { ...l, discount } : l)),
        })),
      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.product.id !== productId) })),
      refreshProducts: (products) =>
        set((state) => {
          const byId = new Map(products.map((p) => [p.id, p]))
          return {
            lines: state.lines.map((l) => ({ ...l, product: byId.get(l.product.id) ?? l.product })),
          }
        }),
      clear: () => set({ lines: [], customer: null }),
    }),
    {
      name: 'sevento-pos-cart',
      storage: createJSONStorage(() => sessionStorage),
      version: 2,
    },
  ),
)
