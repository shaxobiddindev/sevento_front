import type { ReportFilter } from '@/shared/api/types'
import { toIsoDate } from '@/shared/lib/date'

const shift = (date: Date, days: number) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

/** Nuqta filtrida "hammasi" — URL da bo'sh qiymat saqlanmagani uchun alohida belgi. */
export const ALL = 'all'

/** Tez davr tugmalari (mahalliy sana). */
export function periodPresets(today: Date = new Date()) {
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthEnd = shift(monthStart, -1)
  const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1)
  const yesterday = shift(today, -1)
  return [
    { key: 'today', from: toIsoDate(today), to: toIsoDate(today) },
    { key: 'yesterday', from: toIsoDate(yesterday), to: toIsoDate(yesterday) },
    { key: 'week', from: toIsoDate(shift(today, -6)), to: toIsoDate(today) },
    { key: 'month', from: toIsoDate(monthStart), to: toIsoDate(today) },
    { key: 'lastMonth', from: toIsoDate(lastMonthStart), to: toIsoDate(lastMonthEnd) },
  ]
}

/**
 * URL dagi qiymatlar + default lar (backend bilan bir xil: davr — oy boshidan bugungacha,
 * tanlov — ta'rifdagi default, nuqta — sarlavhadagi tanlangan nuqta). Faqat ta'rifdagi nomlar.
 */
export function resolveParams(
  filters: ReportFilter[],
  url: Record<string, string>,
  currentBranchId: number | null,
  today: Date = new Date(),
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const f of filters) {
    const raw = url[f.name]
    if (raw === ALL) {
      continue // "Barcha nuqtalar" — sarlavhadagi nuqta ham qo'yilmaydi
    } else if (raw !== undefined && raw !== '') {
      result[f.name] = raw
    } else if (f.type === 'date') {
      result[f.name] =
        f.name === 'date_from'
          ? toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1))
          : toIsoDate(today)
    } else if (f.type === 'branch' && currentBranchId !== null) {
      result[f.name] = String(currentBranchId)
    } else if (f.default !== null && f.default !== undefined) {
      result[f.name] = f.default
    }
  }
  return result
}
