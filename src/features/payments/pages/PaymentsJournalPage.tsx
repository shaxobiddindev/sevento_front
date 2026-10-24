import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useAuthStore } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import { errorMessage } from '@/shared/api/errors'
import type { PaymentList } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { documentRoute } from '@/shared/lib/documentRoutes'
import {
  Badge,
  Button,
  DataTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  toast,
  type Column,
} from '@/shared/ui'

import {
  usePayment,
  usePaymentMethods,
  usePaymentsJournal,
  useRefundPayment,
} from '../api/payments.api'

/** To'lovlar jurnali: savdo to'lovlari, qaytim, qarz to'lovlari va qaytarishlar. */
export function PaymentsJournalPage() {
  const { t } = useTranslation('payments')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const methods = usePaymentMethods()
  const { params, page, set, setPage } = useListParams()
  const [selected, setSelected] = useState<number | null>(null)
  const journal = usePaymentsJournal({
    page,
    search: params.search,
    kind: params.kind,
    method: params.method,
    date_from: params.date_from,
    date_to: params.date_to,
    branch: branchId ?? undefined,
  })

  const columns: Column<PaymentList>[] = [
    {
      key: 'date',
      header: t('journal.date'),
      className: 'whitespace-nowrap',
      render: (p) => formatDateTime(p.received_at),
    },
    {
      key: 'number',
      header: t('journal.number'),
      className: 'text-xs text-slate-500',
      render: (p) => p.number,
    },
    {
      key: 'kind',
      header: t('journal.kind'),
      render: (p) => (
        <span className="inline-flex items-center gap-1">
          {t(`journal.kinds.${p.kind}`, { defaultValue: p.kind })}
          {p.status === 'reversed' && (
            <Badge tone="neutral">{t('journal.statuses.reversed')}</Badge>
          )}
        </span>
      ),
    },
    { key: 'method', header: t('journal.method'), render: (p) => p.method_name },
    {
      key: 'amount',
      header: t('journal.amount'),
      className: 'text-right tabular-nums whitespace-nowrap font-medium',
      render: (p) => (
        <span className={p.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}>
          {p.direction === 'in' ? '+' : '−'}
          {formatNumber(p.amount, p.currency_decimal_places)} {p.currency_code}
        </span>
      ),
    },
    {
      key: 'customer',
      header: t('journal.customer'),
      render: (p) =>
        p.customer ? (
          <Link
            to={`/customers/${p.customer}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:underline"
          >
            {p.customer_name}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      key: 'doc',
      header: t('journal.document'),
      render: (p) => {
        const to = documentRoute(p.document_type, p.document_id)
        return to ? (
          <Link
            to={to}
            onClick={(e) => e.stopPropagation()}
            className="text-brand-700 hover:underline"
          >
            {p.document_number}
          </Link>
        ) : (
          p.document_number
        )
      },
    },
    { key: 'by', header: t('journal.by'), render: (p) => p.received_by_name },
  ]

  return (
    <div>
      <PageHeader title={t('journal.title')} />
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('journal.searchPlaceholder')}
          className="w-full sm:w-64"
        />
        <Select
          value={params.kind ?? ''}
          onChange={(e) => set({ kind: e.target.value })}
          className="w-full sm:w-44"
          aria-label={t('journal.kind')}
        >
          <option value="">{t('journal.allKinds')}</option>
          {(['payment', 'change', 'refund', 'change_return'] as const).map((k) => (
            <option key={k} value={k}>
              {t(`journal.kinds.${k}`)}
            </option>
          ))}
        </Select>
        <Select
          value={params.method ?? ''}
          onChange={(e) => set({ method: e.target.value })}
          className="w-full sm:w-48"
          aria-label={t('journal.method')}
        >
          <option value="">{t('journal.allMethods')}</option>
          {methods.data?.map((m) => (
            <option key={m.id} value={m.code}>
              {m.name}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={params.date_from ?? ''}
          onChange={(e) => set({ date_from: e.target.value })}
          className="w-full sm:w-40"
          aria-label="date from"
        />
        <Input
          type="date"
          value={params.date_to ?? ''}
          onChange={(e) => set({ date_to: e.target.value })}
          className="w-full sm:w-40"
          aria-label="date to"
        />
      </div>
      <DataTable
        columns={columns}
        rows={journal.data?.results}
        rowKey={(p) => p.id}
        loading={journal.isFetching}
        emptyText={t('journal.empty')}
        onRowClick={(p) => setSelected(p.id)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={journal.data?.total_pages ?? 1}
          count={journal.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
      {selected !== null && <PaymentDetailModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function PaymentDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const payment = usePayment(id)
  const refund = useRefundPayment()
  const { decimals } = useActiveCurrencies()
  const [reason, setReason] = useState('')
  const p = payment.data

  return (
    <Modal
      open
      onClose={onClose}
      title={p ? t('journal.detail', { number: p.number }) : '…'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.close')}
          </Button>
          {p?.can_refund && (
            <Button
              variant="danger"
              disabled={!reason.trim()}
              loading={refund.isPending}
              onClick={() =>
                refund.mutate(
                  { id: p.id, reason: reason.trim() },
                  {
                    onSuccess: () => {
                      toast.success(t('journal.refunded'))
                      onClose()
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
              data-testid="payment-refund"
            >
              {t('journal.refund')}
            </Button>
          )}
        </>
      }
    >
      {p && (
        <div className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-slate-500">{t('journal.amount')}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {formatNumber(p.amount, p.currency_decimal_places)} {p.currency_code}
            </dd>
            <dt className="text-slate-500">{t('journal.method')}</dt>
            <dd className="text-right">{p.method_name}</dd>
            <dt className="text-slate-500">{t('journal.customer')}</dt>
            <dd className="text-right">{p.customer_name ?? '—'}</dd>
            <dt className="text-slate-500">{t('journal.status')}</dt>
            <dd className="text-right">{t(`journal.statuses.${p.status}`)}</dd>
          </dl>
          {p.reversal_of_number && (
            <p className="text-xs text-slate-500">
              {t('journal.reversalOf', { number: p.reversal_of_number })}
            </p>
          )}
          {p.allocations.length > 0 && (
            <div>
              <p className="mb-1 font-medium">{t('pay.allocations')}</p>
              <ul className="divide-y divide-slate-100 rounded border border-slate-200">
                {p.allocations.map((a) => (
                  <li key={a.debt} className="flex justify-between px-3 py-1.5">
                    <Link to={`/sales/${a.document_id}`} className="text-brand-700 hover:underline">
                      {a.document_number}
                    </Link>
                    <span className="tabular-nums">
                      {formatNumber(a.amount, decimals[a.currency_code] ?? 2)} {a.currency_code}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.can_refund && (
            <FormField label={t('journal.refundReason')} hint={t('journal.refundHint')}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </FormField>
          )}
        </div>
      )}
    </Modal>
  )
}
