/**
 * Access token faqat xotirada (localStorage ga yozilmaydi). Sahifa yangilansa
 * refresh cookie orqali qayta olinadi (auth store bootstrap qiladi).
 */
type Listener = (token: string | null) => void

let accessToken: string | null = null
const listeners = new Set<Listener>()
const unauthorizedListeners = new Set<() => void>()

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    accessToken = token
    listeners.forEach((listener) => listener(token))
  },
  clear() {
    tokenStore.set(null)
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Refresh ham ishlamay qolganda (sessiya tugagan) chaqiriladi. */
  onUnauthorized(listener: () => void) {
    unauthorizedListeners.add(listener)
    return () => unauthorizedListeners.delete(listener)
  },
  notifyUnauthorized() {
    unauthorizedListeners.forEach((listener) => listener())
  },
}
