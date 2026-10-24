import { useTranslation } from 'react-i18next'

import { useActiveCurrencies } from '@/features/currency'
import type { CurrentPrice } from '@/shared/api/types'
import { formatMoney } from '@/shared/lib/money'

/** Tovar ro'yxatidagi qisqa narx ko'rinishi: "12 500 UZS · 0,99 USD". */
export function PriceList({ prices, priceType }: { prices: CurrentPrice[]; priceType?: string }) {
  const { t } = useTranslation('catalog')
  const { decimals } = useActiveCurrencies()
  const shown = priceType ? prices.filter((p) => p.price_type === priceType) : prices
  if (!shown.length) return <span className="text-slate-400">{t('products.noPrice')}</span>
  return (
    <span className="tabular-nums">
      {shown.map((p) => formatMoney(p.amount, p.currency, decimals[p.currency] ?? 2)).join(' · ')}
    </span>
  )
}
