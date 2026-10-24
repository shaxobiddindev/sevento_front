import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import { formatNumber } from '@/shared/lib/money'
import { Card, Spinner } from '@/shared/ui'

import { useDailySummary } from '../api/sales.api'

/** Dashboard kartasi: bugungi savdo (dashboard.updated / payment.received bilan jonli). */
export function TodaySales() {
  const { t } = useTranslation('sales')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const summary = useDailySummary({ branch: branchId })
  const { decimals } = useActiveCurrencies()
  const data = summary.data

  return (
    <Card data-testid="today-sales">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{t('summary.title')}</h2>
        {summary.isFetching && <Spinner className="size-4 text-slate-400" />}
      </div>
      {!data ? null : data.count === 0 ? (
        <p className="text-sm text-slate-500">{t('summary.none')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">{t('summary.count')}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums" data-testid="today-count">
              {data.count}
            </p>
            {data.cancelled_count > 0 && (
              <p className="text-xs text-slate-500">
                {t('summary.cancelled', { count: data.cancelled_count })}
              </p>
            )}
            {data.returns_count > 0 && (
              <p className="text-xs text-amber-700" data-testid="today-returns">
                {t('summary.returns', {
                  count: data.returns_count,
                  total: formatNumber(data.returns_total_base, 2),
                  base: data.base_currency,
                })}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">{t('summary.revenue')}</p>
            {data.by_currency.map((row) => (
              <p
                key={row.currency}
                className="mt-1 text-lg font-semibold tabular-nums"
                data-testid={`today-total-${row.currency}`}
              >
                {formatNumber(row.total, decimals[row.currency] ?? 2)} {row.currency}
              </p>
            ))}
          </div>
          {data.profit_base !== null && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                {t('summary.profit', { base: data.base_currency })}
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-700 tabular-nums">
                {formatNumber(data.profit_base, decimals[data.base_currency] ?? 2)}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
