/**
 * Sana formati: 22.10.2026 va 22.10.2026 14:05 (mahalliy vaqt). Brauzer lokaliga tayanmaymiz —
 * `uz` lokali hamma joyda (Chromium/WebKit buildlari, Tauri) bo'lmaydi.
 */
const pad = (n: number) => String(n).padStart(2, '0')
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function toDate(value: string | Date): Date | null {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  // "2026-10-22" — vaqt zonasi siljishisiz (new Date uni UTC yarim tun deb o'qiydi)
  if (typeof value === 'string') {
    const m = DATE_ONLY.exec(value)
    if (m) return `${m[3]}.${m[2]}.${m[1]}`
  }
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

/** YYYY-MM-DD (API filtrlari uchun, mahalliy sana). */
export function toIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
