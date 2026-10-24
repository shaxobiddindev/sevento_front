/**
 * Platforma: brauzer/PWA yoki Tauri desktop. Desktop farqlari faqat shu papkada
 * (`desktop.ts` — main.tsx da faqat Tauri ichida dinamik yuklanadi, veb bundle ga kirmaydi).
 */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}
