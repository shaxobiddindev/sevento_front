import type { ReportColumn } from '@/shared/api/types'
import { formatDate, formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'

export type Cell = string | number | boolean | null | undefined

export function isNumeric(column: ReportColumn): boolean {
  return ['number', 'money', 'quantity', 'percent'].includes(column.type)
}

export function decimalsFor(column: ReportColumn, row?: Record<string, unknown>): number {
  const own = column.decimals_key ? row?.[column.decimals_key] : undefined
  return typeof own === 'number' ? own : column.decimals
}

/** Jadval katagi: sonlar o'zbekcha (12 650,45), miqdor ortiqcha nollarsiz, sana dd.mm.yyyy. */
export function formatCell(column: ReportColumn, value: unknown, row?: Record<string, unknown>) {
  if (value === null || value === undefined || value === '') return ''
  if (isNumeric(column)) {
    const decimals = decimalsFor(column, row)
    const text = formatNumber(String(value), decimals)
    // faqat kasr qismidagi nollar (butun son "40" → "4" bo'lib qolmasin)
    const trimmed = column.type === 'quantity' && decimals > 0 ? text.replace(/,?0+$/, '') : text
    return column.type === 'percent' ? `${trimmed}%` : trimmed
  }
  if (column.type === 'datetime') return formatDateTime(String(value))
  if (column.type === 'date') return formatDate(String(value))
  return String(value)
}
