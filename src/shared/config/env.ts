const trimSlash = (value?: string) => (value ?? '').replace(/\/+$/, '')

/** Muhit sozlamalari. Bo'sh manzil = joriy sayt (dev da Vite proxy, prod da Nginx). */
export const env = {
  apiUrl: trimSlash(import.meta.env.VITE_API_URL),
  wsUrl: trimSlash(import.meta.env.VITE_WS_URL),
  apiBase: `${trimSlash(import.meta.env.VITE_API_URL)}/api/v1`,
  isDev: import.meta.env.DEV,
} as const
