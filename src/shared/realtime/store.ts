import { create } from 'zustand'

export type RealtimeStatus = 'idle' | 'connecting' | 'online' | 'offline'

interface RealtimeState {
  status: RealtimeStatus
  /** Qachondan beri uzilgan (banner uchun) */
  offlineSince: number | null
  lastMessageAt: number | null
  setStatus: (status: RealtimeStatus) => void
  touch: () => void
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: 'idle',
  offlineSince: null,
  lastMessageAt: null,
  setStatus: (status) =>
    set((state) => ({
      status,
      offlineSince: status === 'offline' ? (state.offlineSince ?? Date.now()) : null,
    })),
  touch: () => set({ lastMessageAt: Date.now() }),
}))
