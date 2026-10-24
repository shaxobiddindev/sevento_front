import type { CurrencyAmount } from '@/shared/api/types'
import { formatNumber } from '@/shared/lib/money'

/** Qarz qoldiqlari: "125 000 UZS · 5,00 USD" (valyuta kasr xonasi jadvaldan). */
export function formatBalances(
  balances: { currency: string; amount: string }[] | CurrencyAmount[],
  decimals: Record<string, number>,
): string {
  if (!balances.length) return '—'
  return balances
    .map((b) => `${formatNumber(b.amount, decimals[b.currency] ?? 2)} ${b.currency}`)
    .join(' · ')
}
