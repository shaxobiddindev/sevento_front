import { ArrowLeft, HandCoins, Pencil, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { LedgerEntry } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  PageSpinner,
  Pagination,
  Select,
  type Column,
} from '@/shared/ui'

import { useCustomer, useCustomerLedger } from '../api/payments.api'
import { CustomerFormModal } from '../components/CustomerFormModal'
import { DebtPaymentModal } from '../components/DebtPaymentModal'
import { DebtsTable } from '../components/DebtsTable'
import { formatBalances } from '../lib/format'

/** Mijoz kartasi: kredit holati, qarz qoldig'i, ochiq qarzlar, to'lov qabul qilish, akt-sverka. */
export function CustomerDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const canManage = useCapability('customers.manage')
  const canReceive = useCapability('payments.receive')
  const { decimals, currencies } = useActiveCurrencies()
  const customer = useCustomer(id)
  const { params, page, set, setPage } = useListParams()
  const ledger = useCustomerLedger(id!, { page, currency: params.currency })
  const [editing, setEditing] = useState(false)
  const [paying, setPaying] = useState(false)

  if (customer.isPending) return <PageSpinner />
  if (!customer.data) return null
  const c = customer.data
  const credit = c.credit
  const base = credit.base_currency
  const baseDp = decimals[base] ?? 2
  const limit = Number(credit.limit_base)
  const used = Number(credit.used_base)
  const percent = limit > 0 ? Math.min((used / limit) * 100, 100) : used > 0 ? 100 : 0
  const warn = Number(credit.warning_percent)

  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      key: 'date',
      header: t('ledger.date'),
      className: 'whitespace-nowrap',
      render: (e) => formatDateTime(e.created_at),
    },
    {
      key: 'type',
      header: t('ledger.type'),
      render: (e) => (
        <span>
          {t(`ledger.types.${e.type}`)}
          {e.method_name && <span className="ml-1 text-xs text-slate-500">({e.method_name})</span>}
        </span>
      ),
    },
    {
      key: 'doc',
      header: t('ledger.document'),
      render: (e) =>
        e.document_type === 'sale' && e.document_id ? (
          <Link to={`/sales/${e.document_id}`} className="text-brand-700 hover:underline">
            {e.document_number}
          </Link>
        ) : (
          (e.payment_number ?? e.document_number)
        ),
    },
    {
      key: 'amount',
      header: t('ledger.amount'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (e) => {
        const n = Number(e.amount)
        return (
          <span className={n > 0 ? 'text-red-700' : 'text-emerald-700'}>
            {n > 0 ? '+' : ''}
            {formatNumber(e.amount, e.currency_decimal_places)} {e.currency_code}
          </span>
        )
      },
    },
    {
      key: 'balance',
      header: t('ledger.balance'),
      className: 'text-right tabular-nums font-medium',
      render: (e) => formatNumber(e.balance_after, e.currency_decimal_places),
    },
    { key: 'by', header: t('ledger.by'), render: (e) => e.created_by_name },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={c.name}
        subtitle={[c.phone, c.tin, c.address].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            {canReceive && c.balances.length > 0 && (
              <Button
                icon={<HandCoins className="size-4" />}
                onClick={() => setPaying(true)}
                data-testid="customer-pay"
              >
                {t('pay.title')}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={<Receipt className="size-4" />}
              onClick={() => navigate(`/sales?customer=${c.id}`)}
            >
              {t('customers.sales')}
            </Button>
            {canManage && (
              <Button
                variant="secondary"
                icon={<Pencil className="size-4" />}
                onClick={() => setEditing(true)}
              >
                {tc('actions.edit')}
              </Button>
            )}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate(-1)}
            >
              {tc('actions.back')}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t('credit.title')}</h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500 uppercase">{t('credit.limit')}</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatNumber(credit.limit_base, baseDp)} {base}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">{t('credit.used')}</p>
              <p className="text-lg font-semibold tabular-nums" data-testid="credit-used">
                {formatNumber(credit.used_base, baseDp)} {base}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase">{t('credit.available')}</p>
              <p
                className="text-lg font-semibold text-emerald-700 tabular-nums"
                data-testid="credit-available"
              >
                {formatNumber(credit.available_base, baseDp)} {base}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <div
              className={cn(
                'h-full rounded-full',
                percent >= 100 ? 'bg-red-600' : percent >= warn ? 'bg-amber-500' : 'bg-emerald-500',
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('credit.warning', { percent: formatNumber(credit.warning_percent, 0) })} ·{' '}
            {t('credit.dueDays', { days: credit.due_days })}
          </p>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t('credit.balances')}</h2>
          {c.balances.length === 0 ? (
            <p className="text-sm text-slate-500">{t('customers.noDebt')}</p>
          ) : (
            <ul className="space-y-1" data-testid="customer-balances">
              {c.balances.map((b) => (
                <li
                  key={b.currency}
                  className="flex justify-between text-lg font-semibold tabular-nums"
                >
                  <span className="text-sm font-normal text-slate-500">{b.currency}</span>
                  {formatNumber(b.amount, decimals[b.currency] ?? 2)}
                </li>
              ))}
            </ul>
          )}
          {c.has_overdue && (
            <p className="mt-2 text-sm font-medium text-red-700">{t('customers.overdue')}</p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          {t('credit.openDebts')}
          {c.balances.length > 0 && (
            <span className="ml-2 font-normal text-slate-500">
              {formatBalances(c.balances, decimals)}
            </span>
          )}
        </h2>
        <DebtsTable rows={c.open_debts} showCustomer={false} />
      </Card>

      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">{t('ledger.title')}</h2>
          <Select
            value={params.currency ?? ''}
            onChange={(e) => set({ currency: e.target.value })}
            className="w-full sm:w-44"
            aria-label={t('pay.currency')}
          >
            <option value="">{t('ledger.allCurrencies')}</option>
            {currencies.map((cur) => (
              <option key={cur.id} value={cur.code}>
                {cur.code}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          columns={ledgerColumns}
          rows={ledger.data?.results}
          rowKey={(e) => e.id}
          loading={ledger.isFetching}
          emptyText={t('ledger.empty')}
        />
        <div className="mt-3">
          <Pagination
            page={page}
            totalPages={ledger.data?.total_pages ?? 1}
            count={ledger.data?.count ?? 0}
            onChange={setPage}
          />
        </div>
      </Card>

      <CustomerFormModal customer={c} open={editing} onClose={() => setEditing(false)} />
      {paying && <DebtPaymentModal customer={c} onClose={() => setPaying(false)} />}
    </div>
  )
}
