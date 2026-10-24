/**
 * Pul va miqdor API da satr ("12500.00") — float emas. Bu yerda faqat ko'rsatish/formatlash.
 * Yakuniy summalar doim backend dan keladi.
 *
 * O'zbekcha format: 12 650,45 (minglik — bo'linmas bo'sh joy, kasr — vergul). Brauzerning lokal
 * ma'lumotiga tayanmaymiz: Chromium/WebKit ning ba'zi buildlarida `uz` lokali yo'q va
 * Intl jim ingliz formatiga (12,650.45) qaytadi — bu chalkashlik tug'diradi.
 */
const GROUP = '\u00A0'
const DECIMAL = ','
const formatters = new Map<number, Intl.NumberFormat>()

function formatter(decimals: number): Intl.NumberFormat {
  let fmt = formatters.get(decimals)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    })
    formatters.set(decimals, fmt)
  }
  return fmt
}

export function formatNumber(value: string | number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  return formatter(decimals)
    .formatToParts(num)
    .map((part) => (part.type === 'group' ? GROUP : part.type === 'decimal' ? DECIMAL : part.value))
    .join('')
}

export function formatMoney(
  value: string | number | null | undefined,
  currency?: string,
  decimals = 2,
): string {
  const text = formatNumber(value, decimals)
  return currency && text !== '—' ? `${text} ${currency}` : text
}

/** API dagi "25.500" → forma maydoni uchun "25,5" (ortiqcha nollarsiz, o'zbekcha vergul). */
export function toDecimalInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) ? String(n).replace('.', ',') : ''
}

/** Foydalanuvchi kiritgan son (bo'sh joy yoki vergul bilan) → API uchun "12650.45". */
export function parseDecimalInput(text: string): string {
  return text.replace(/[\s\u00A0]/g, '').replace(',', '.')
}

/** Birlik aniqligi: dona → 0 xona, kg → 3 xona ("1,500" kg uchun to'g'ri, dona uchun "1,5" — yo'q). */
export function fitsPrecision(quantity: string, places: number): boolean {
  const text = parseDecimalInput(quantity || '')
  const [, fraction = ''] = text.split('.')
  return fraction.replace(/0+$/, '').length <= places
}
