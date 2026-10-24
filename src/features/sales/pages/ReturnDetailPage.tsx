import { ArrowLeft, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { useActiveCurrencies } from '@/features/currency'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { Button, Card, PageHeader, PageSpinner } from '@/shared/ui'

import { useReturn } from '../api/sales.api'

export function ReturnDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation('sales')
  const navigate = useNavigate()
  const { base } = useActiveCurrencies()
  const query = useReturn(id)
  if (query.isPending) return <PageSpinner />
  if (!query.data) return null
  const r = query.data
  const places = r.currency_decimal_places
  const showCost = r.cost_base !== null

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={r.number}
        subtitle={`${formatDateTime(r.created_at)} · ${r.branch_name} · ${r.created_by_name}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Receipt className="size-4" />}
              onClick={() => navigate(`/sales/${r.sale}`)}
            >
              {t('returns.toSale')} {r.sale_number}
            </Button>
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate(-1)}
            >
              {t('common:actions.back')}
            </Button>
          </>
        }
      />
      <Card className="grid gap-3 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500 uppercase">{t('returns.customer')}</p>
          {r.customer ? (
            <Link
              to={`/customers/${r.customer}`}
              className="font-medium text-brand-700 hover:underline"
            >
              {r.customer_name}
            </Link>
          ) : (
            '—'
          )}
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">{t('returns.total')}</p>
          <p className="font-semibold tabular-nums">
            {formatNumber(r.total, places)} {r.currency_code}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">{t('returns.debtReduction')}</p>
          <p className="tabular-nums">{formatNumber(r.debt_reduction, places)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">{t('returns.refund')}</p>
          <p className="tabular-nums">
            {formatNumber(r.refund_amount, places)}
            {r.refund_method_name && (
              <span className="ml-1 text-xs text-slate-500">({r.refund_method_name})</span>
            )}
          </p>
        </div>
        <p className="text-slate-600 sm:col-span-4">
          {t('returns.reason')}: {r.reason}
        </p>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="pb-2">{t('returns.product')}</th>
              <th className="pb-2 text-right">{t('returns.quantity')}</th>
              <th className="pb-2 text-right">{t('returns.amount')}</th>
              {showCost && <th className="pb-2 text-right">{t('returns.cost', { base })}</th>}
            </tr>
          </thead>
          <tbody>
            {r.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-2">{item.product_name}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(item.quantity, item.unit_decimal_places)} {item.unit_code}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(item.amount, places)}
                </td>
                {showCost && (
                  <td className="py-2 text-right text-slate-500 tabular-nums">
                    {formatNumber(item.cost_base ?? '0', 2)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
