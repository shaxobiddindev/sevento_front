import { useTranslation } from 'react-i18next'

import { isApiError } from '@/shared/api/errors'
import type { PurchaseDetail } from '@/shared/api/types'
import { formatMoney, formatNumber } from '@/shared/lib/money'
import { Card, Spinner } from '@/shared/ui'

import { useCostPreview } from '../api/purchasing.api'

interface Row {
  key: number
  name: string
  quantity: string
  unit: string
  lineBase: string
  allocated: string
  landed: string
}

/**
 * Tannarx hisob-kitobi (asosiy valyutada). Qoralama — serverdan joriy kurs bilan oldindan hisob;
 * qabul qilingan — saqlangan qiymatlar (qabul paytidagi kurs).
 */
export function CostSummary({
  purchase,
  base,
  decimals,
  dirty,
}: {
  purchase: PurchaseDetail
  base: string
  decimals: Record<string, number>
  dirty: boolean
}) {
  const { t } = useTranslation('purchasing')
  const isDraft = purchase.status === 'draft'
  const preview = useCostPreview(purchase.id, isDraft && purchase.items.length > 0)
  const places = decimals[base] ?? 2

  if (purchase.status === 'cancelled' && !purchase.received_at) return null
  if (isDraft && preview.isPending && preview.fetchStatus !== 'idle') {
    return (
      <Card className="flex justify-center">
        <Spinner className="size-5 text-brand-700" />
      </Card>
    )
  }
  if (isDraft && preview.error) {
    const missing = isApiError(preview.error) && preview.error.code === 'rate_unavailable'
    return (
      <Card>
        <h2 className="text-base font-semibold">{t('costs.title')}</h2>
        <p className="mt-2 text-sm text-amber-700">
          {missing ? t('costs.rateMissing') : preview.error.message}
        </p>
      </Card>
    )
  }
  const totals = isDraft
    ? preview.data
    : {
        rate_to_base: purchase.rate_to_base ?? '1',
        subtotal_base: purchase.subtotal_base,
        expenses_total_base: purchase.expenses_total_base,
        total_base: purchase.total_base,
      }
  if (!totals) return null

  const rows: Row[] = purchase.items.map((item, index) => {
    const line = isDraft ? preview.data?.lines[index] : item
    return {
      key: item.id,
      name: item.product_name,
      quantity: formatNumber(item.quantity, item.unit_decimal_places),
      unit: item.unit_code,
      lineBase: formatNumber(line?.line_total_base ?? '0', places),
      allocated: formatNumber(line?.allocated_expense_base ?? '0', places),
      landed: formatNumber(line?.landed_unit_cost_base ?? '0', 4),
    }
  })

  return (
    <Card>
      <div className="mb-3">
        <h2 className="text-base font-semibold">{t('costs.title')}</h2>
        {isDraft && (
          <p className="text-xs text-slate-500">
            {t('costs.previewHint')}
            {dirty ? ' *' : ''}
          </p>
        )}
        {purchase.currency_code !== base && (
          <p className="mt-1 text-xs text-slate-500">
            {t('costs.rate', {
              currency: purchase.currency_code,
              rate: formatNumber(totals.rate_to_base, 6),
              base,
            })}
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm" data-testid="cost-table">
          <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="pb-2">{t('form.product')}</th>
              <th className="pb-2 text-right">{t('form.quantity')}</th>
              <th className="pb-2 text-right">{t('costs.lineBase', { base })}</th>
              <th className="pb-2 text-right">{t('costs.allocated')}</th>
              <th className="pb-2 text-right">{t('costs.landed')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="py-1.5">{r.name}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {r.quantity} {r.unit}
                </td>
                <td className="py-1.5 text-right tabular-nums">{r.lineBase}</td>
                <td className="py-1.5 text-right tabular-nums">{r.allocated}</td>
                <td className="py-1.5 text-right font-medium tabular-nums">{r.landed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">{t('costs.subtotalBase')}</dt>
          <dd className="font-semibold tabular-nums">
            {formatMoney(totals.subtotal_base, base, places)}
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs text-slate-500">{t('costs.expensesBase')}</dt>
          <dd className="font-semibold tabular-nums">
            {formatMoney(totals.expenses_total_base, base, places)}
          </dd>
        </div>
        <div className="rounded-md bg-brand-50 p-3">
          <dt className="text-xs text-brand-800">{t('costs.totalBase')}</dt>
          <dd className="font-semibold tabular-nums text-brand-900" data-testid="cost-total">
            {formatMoney(totals.total_base, base, places)}
          </dd>
        </div>
      </dl>
    </Card>
  )
}
