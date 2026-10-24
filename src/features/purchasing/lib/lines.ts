import { parseDecimalInput } from '@/shared/lib/money'

/**
 * Qator summasi — faqat ko'rsatish uchun (yakuniy summa va tannarx doim backend dan).
 * Butun "sent" larda hisoblanadi, float xatosi ko'rinmasin.
 */
export function lineTotal(quantity: string, unitPrice: string): number | null {
  const q = Number(parseDecimalInput(quantity || ''))
  const p = Number(parseDecimalInput(unitPrice || ''))
  if (!Number.isFinite(q) || !Number.isFinite(p) || quantity === '' || unitPrice === '') return null
  return Math.round(q * 1000 * Math.round(p * 10000)) / 1e7
}

export function sumTotals(lines: { quantity: string; unit_price: string }[]): number {
  return lines.reduce((acc, l) => acc + (lineTotal(l.quantity, l.unit_price) ?? 0), 0)
}

export { fitsPrecision } from '@/shared/lib/money'
