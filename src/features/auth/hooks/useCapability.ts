import { useAuthStore } from '../store/authStore'

/** Menyu va tugmalarni yashirish uchun. Backend baribir tekshiradi. */
export function useCapability(code: string | null | undefined): boolean {
  return useAuthStore((s) => (code ? (s.user?.capabilities.includes(code) ?? false) : true))
}

export function useHasAnyCapability(codes: readonly string[]): boolean {
  return useAuthStore((s) => codes.some((c) => s.user?.capabilities.includes(c)))
}
