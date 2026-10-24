import type { PickedProduct } from '@/features/catalog'
import { fitsPrecision, formatNumber, parseDecimalInput } from '@/shared/lib/money'

/** Hujjat qatori (ko'chirish, hisobdan chiqarish): tovar + miqdor. key — React ro'yxati uchun. */
export interface LineValue {
  key: string
  product: PickedProduct | null
  quantity: string
}

export type LineErrors = Record<number, { product?: string; quantity?: string }>

let seq = 0
export function newLine(product: PickedProduct | null = null, quantity = ''): LineValue {
  seq += 1
  return { key: `l${seq}`, product, quantity }
}

export type LineProblem = 'required' | 'positive' | 'precision' | 'duplicate'

/** Mijoz tomonida tekshiruv (server baribir tekshiradi): bo'sh, musbat, birlik aniqligi, takror. */
export function validateLines(
  lines: LineValue[],
): Record<number, { product?: LineProblem; quantity?: LineProblem }> {
  const errors: Record<number, { product?: LineProblem; quantity?: LineProblem }> = {}
  const seen = new Set<number>()
  lines.forEach((line, index) => {
    const err: { product?: LineProblem; quantity?: LineProblem } = {}
    if (!line.product) err.product = 'required'
    else if (seen.has(line.product.id)) err.product = 'duplicate'
    else seen.add(line.product.id)
    const qty = Number(parseDecimalInput(line.quantity || ''))
    if (!line.quantity.trim() || !Number.isFinite(qty) || qty <= 0) err.quantity = 'positive'
    else if (line.product && !fitsPrecision(line.quantity, line.product.unit_decimal_places))
      err.quantity = 'precision'
    if (err.product || err.quantity) errors[index] = err
  })
  return errors
}

export function toLineRequests(lines: LineValue[]): { product: number; quantity: string }[] {
  return lines
    .filter((l) => l.product)
    .map((l) => ({ product: l.product!.id, quantity: parseDecimalInput(l.quantity) }))
}

/** Miqdor: birlik aniqligida, ortiqcha nollarsiz ("12,500" → "12,5"; dona — butun). */
export function formatQty(value: string | number | null | undefined, places = 3): string {
  if (value === null || value === undefined || value === '') return '—'
  const text = formatNumber(value, places)
  return places > 0 ? text.replace(/,?0+$/, '') : text
}

/** Server xatosidagi "items.N.<field>" larni qatorlarga, qolganini alohida qaytaradi. */
export function splitLineErrors(
  details: { field?: string | null; message: string }[],
  lineFields: readonly string[] = ['product', 'quantity'],
): { lines: LineErrors; rest: { field?: string | null; message: string }[] } {
  const lines: LineErrors = {}
  const rest: { field?: string | null; message: string }[] = []
  for (const detail of details) {
    const match = /^items\.(\d+)\.(\w+)$/.exec(detail.field ?? '')
    if (match && lineFields.includes(match[2])) {
      const index = Number(match[1])
      lines[index] = { ...lines[index], [match[2]]: detail.message }
    } else {
      rest.push(detail)
    }
  }
  return { lines, rest }
}
