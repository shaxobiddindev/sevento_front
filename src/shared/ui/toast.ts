import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
  duration: number
}

interface ToastState {
  items: ToastItem[]
  push: (item: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => number
  dismiss: (id: number) => void
}

let counter = 0

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (item) => {
    const id = ++counter
    const duration = item.duration ?? (item.kind === 'error' ? 6000 : 3500)
    set((state) => ({ items: [...state.items, { ...item, id, duration }] }))
    if (duration > 0) {
      setTimeout(
        () => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
        duration,
      )
    }
    return id
  },
  dismiss: (id) => set((state) => ({ items: state.items.filter((t) => t.id !== id) })),
}))

const push = (kind: ToastKind) => (title: string, description?: string) =>
  useToastStore.getState().push({ kind, title, description })

/** Komponent va hooklardan: toast.success('Saqlandi') */
export const toast = {
  success: push('success'),
  error: push('error'),
  info: push('info'),
  warning: push('warning'),
}
