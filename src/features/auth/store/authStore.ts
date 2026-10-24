import { create } from 'zustand'

import { refreshAccess } from '@/shared/api/client'
import { isApiError } from '@/shared/api/errors'
import { queryClient } from '@/shared/api/queryClient'
import { tokenStore } from '@/shared/api/tokenStore'
import type { Me } from '@/shared/api/types'
import i18n from '@/shared/i18n'
import { toast } from '@/shared/ui/toast'

import { authApi } from '../api/auth.api'

/** offline — server bilan aloqa yo'q (sessiya bor-yo'qligi noma'lum): "Internet yo'q" ekrani */
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'offline'

const BRANCH_KEY = 'sevento.currentBranch'

function readStoredBranch(): number | null {
  try {
    const raw = localStorage.getItem(BRANCH_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function storeBranch(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(BRANCH_KEY)
    else localStorage.setItem(BRANCH_KEY, String(id))
  } catch {
    /* private rejim va h.k. — e'tiborsiz */
  }
}

/** Foydalanuvchi uchun joriy nuqtani tanlash: saqlangan → asosiy → bitta bo'lsa o'sha → null (hammasi). */
function pickBranch(me: Me): number | null {
  const ids = me.branches.map((b) => b.id)
  const stored = readStoredBranch()
  if (stored !== null && ids.includes(stored)) return stored
  const def = me.branches.find((b) => b.is_default)
  if (def) return def.id
  if (!me.all_branches && ids.length) return ids[0]
  return null
}

interface AuthState {
  status: AuthStatus
  user: Me | null
  currentBranchId: number | null
  bootstrap: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: Me) => void
  /** me ni qayta o'qiydi (huquqlar o'zgarganda); 401/403 bo'lsa chiqaradi. false = chiqarildi */
  refreshUser: () => Promise<boolean>
  setCurrentBranch: (id: number | null) => void
  hasCapability: (code: string) => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  user: null,
  currentBranchId: null,

  async bootstrap() {
    if (get().status === 'loading') return
    set({ status: 'loading' })
    let token: string | null
    try {
      token = await refreshAccess()
    } catch {
      // tarmoq yoki server ishlamayapti — login emas, "Internet yo'q" (aloqa tiklansa qayta)
      set({ status: 'offline', user: null })
      return
    }
    if (!token) {
      set({ status: 'anonymous', user: null })
      return
    }
    try {
      const me = await authApi.me()
      set({ status: 'authenticated', user: me, currentBranchId: pickBranch(me) })
    } catch (error) {
      if (isApiError(error) && (error.status === 0 || error.status >= 500)) {
        set({ status: 'offline', user: null })
        return
      }
      tokenStore.clear()
      set({ status: 'anonymous', user: null })
    }
  },

  async login(username, password) {
    const { access, user } = await authApi.login({ username, password })
    tokenStore.set(access)
    set({ status: 'authenticated', user, currentBranchId: pickBranch(user) })
  },

  async logout() {
    try {
      await authApi.logout()
    } catch {
      /* cookie allaqachon yo'q bo'lishi mumkin */
    }
    tokenStore.clear()
    queryClient.clear()
    set({ status: 'anonymous', user: null, currentBranchId: null })
  },

  setUser(user) {
    set({ user, currentBranchId: pickBranch(user) })
  },

  async refreshUser() {
    try {
      const me = await authApi.me()
      set({ user: me, currentBranchId: pickBranch(me) })
      await queryClient.invalidateQueries()
      return true
    } catch {
      await get().logout()
      return false
    }
  },

  setCurrentBranch(id) {
    storeBranch(id)
    set({ currentBranchId: id })
  },

  hasCapability(code) {
    return get().user?.capabilities.includes(code) ?? false
  },
}))

// Refresh ham ishlamay qolsa (sessiya tugadi) — login sahifasiga
tokenStore.onUnauthorized(() => {
  if (useAuthStore.getState().status === 'authenticated') {
    queryClient.clear()
    useAuthStore.setState({ status: 'anonymous', user: null })
    toast.warning(i18n.t('auth:sessionExpired'))
  }
})

// Ilova oflayn ochilgan bo'lsa — aloqa tiklanishi bilan sessiyani qayta tiklashga urinadi
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (useAuthStore.getState().status === 'offline') void useAuthStore.getState().bootstrap()
  })
}
