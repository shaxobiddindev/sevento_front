import { ArrowDownUp, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import type { CashTransaction, Cashbox } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { documentRoute } from '@/shared/lib/documentRoutes'
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Select,
  type Column,
} from '@/shared/ui'

import { useCashboxes, useCashCategories, useCashTransactions } from '../api/payments.api'
import { CashEntryModal } from '../components/CashEntryModal'
import { ShiftPanel } from '../components/ShiftPanel'

/** Kassa qoldig'i (nuqta × valyuta) va kassa jurnali. To'lovlar realtime bilan yangilanadi. */
export function CashPage() {
  const { t } = useTranslation('payments')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const canManage = useCapability('cashbox.manage')
  const [entryOpen, setEntryOpen] = useState(false)
  const cashboxes = useCashboxes({ branch: branchId })
  const categories = useCashCategories()
  const { params, page, set, setPage } = useListParams()
  const journal = useCashTransactions({
    page,
    branch: branchId ?? undefined,
    cashbox: params.cashbox,
    direction: params.direction,
    category: params.category,
    date_from: params.date_from,
    date_to: params.date_to,
  })
  const boxes = cashboxes.data ?? []
  const decimalsOf = (code: string) =>
    boxes.find((b) => b.currency_code === code)?.currency_decimal_places ?? 2

  const columns: Column<CashTransaction>[] = [
    {
      key: 'date',
      header: t('cash.date'),
      className: 'whitespace-nowrap',
      render: (tx) => formatDateTime(tx.created_at),
    },
    { key: 'cashbox', header: t('cash.cashbox'), render: (tx) => tx.cashbox_name },
    { key: 'category', header: t('cash.category'), render: (tx) => tx.category_name },
    {
      key: 'amount',
      header: t('cash.amount'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (tx) => (
        <span className={tx.direction === 'in' ? 'text-emerald-700' : 'text-red-700'}>
          {tx.direction === 'in' ? '+' : '−'}
          {formatNumber(tx.amount, decimalsOf(tx.currency_code))} {tx.currency_code}
        </span>
      ),
    },
    {
      key: 'balance',
      header: t('cash.balanceAfter'),
      className: 'text-right tabular-nums',
      render: (tx) => formatNumber(tx.balance_after, decimalsOf(tx.currency_code)),
    },
    {
      key: 'doc',
      header: t('cash.document'),
      render: (tx) => {
        const route = documentRoute(tx.document_type, tx.document_id)
        const label = tx.document_number || tx.payment_number || '—'
        return route ? (
          <Link to={route} className="text-brand-700 hover:underline">
            {label}
          </Link>
        ) : (
          label
        )
      },
    },
    { key: 'by', header: t('cash.by'), render: (tx) => tx.created_by_name },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('cash.title')}
        actions={
          canManage &&
          branchId !== null && (
            <Button
              variant="secondary"
              icon={<ArrowDownUp className="size-4" />}
              onClick={() => setEntryOpen(true)}
              data-testid="entry-new"
            >
              {t('entry.new')}
            </Button>
          )
        }
      />
      {branchId !== null && <ShiftPanel branchId={branchId} />}
      {boxes.length === 0 && !cashboxes.isPending ? (
        <Card>
          <EmptyState text={t('cash.empty')} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {boxes.map((box: Cashbox) => (
            <Card
              key={box.id}
              className="p-4"
              data-testid={`cashbox-${box.branch}-${box.currency_code}`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                <Wallet className="size-4" />
                {box.branch_name}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums" data-testid="cashbox-balance">
                {formatNumber(box.balance, box.currency_decimal_places)}{' '}
                <span className="text-base font-semibold text-slate-500">{box.currency_code}</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t('cash.updated', { date: formatDateTime(box.updated_at) })}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">{t('cash.journal')}</h2>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <FormField label={t('cash.cashbox')} className="w-full sm:w-52">
            <Select value={params.cashbox ?? ''} onChange={(e) => set({ cashbox: e.target.value })}>
              <option value="">{t('cash.allCashboxes')}</option>
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('cash.direction')} className="w-full sm:w-36">
            <Select
              value={params.direction ?? ''}
              onChange={(e) => set({ direction: e.target.value })}
            >
              <option value="">{t('cash.both')}</option>
              <option value="in">{t('cash.in')}</option>
              <option value="out">{t('cash.out')}</option>
            </Select>
          </FormField>
          <FormField label={t('cash.category')} className="w-full sm:w-48">
            <Select
              value={params.category ?? ''}
              onChange={(e) => set({ category: e.target.value })}
            >
              <option value="">{t('cash.allCategories')}</option>
              {categories.data?.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('cash.dateFrom')}>
            <Input
              type="date"
              value={params.date_from ?? ''}
              onChange={(e) => set({ date_from: e.target.value })}
            />
          </FormField>
          <FormField label={t('cash.dateTo')}>
            <Input
              type="date"
              value={params.date_to ?? ''}
              onChange={(e) => set({ date_to: e.target.value })}
            />
          </FormField>
        </div>
        <DataTable
          columns={columns}
          rows={journal.data?.results}
          rowKey={(tx) => tx.id}
          loading={journal.isFetching}
          emptyText={t('cash.empty')}
        />
        <div className={cn('mt-3', !journal.data?.count && 'hidden')}>
          <Pagination
            page={page}
            totalPages={journal.data?.total_pages ?? 1}
            count={journal.data?.count ?? 0}
            onChange={setPage}
          />
        </div>
      </Card>
      {entryOpen && branchId !== null && (
        <CashEntryModal branchId={branchId} onClose={() => setEntryOpen(false)} />
      )}
    </div>
  )
}
