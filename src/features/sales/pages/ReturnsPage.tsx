import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuthStore } from '@/features/auth'
import type { SaleReturnList } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { DataTable, Input, PageHeader, Pagination, SearchInput, type Column } from '@/shared/ui'

import { useReturns } from '../api/sales.api'

/** Qaytarishlar jurnali (nuqta bo'yicha). Yangi qaytarish — savdo sahifasidan. */
export function ReturnsPage() {
  const { t } = useTranslation('sales')
  const navigate = useNavigate()
  const branchId = useAuthStore((s) => s.currentBranchId)
  const { params, page, set, setPage } = useListParams()
  const returns = useReturns({
    page,
    search: params.search,
    date_from: params.date_from,
    date_to: params.date_to,
    branch: branchId ?? undefined,
  })

  const money = (value: string, r: SaleReturnList) =>
    Number(value) ? `${formatNumber(value, r.currency_decimal_places)} ${r.currency_code}` : '—'

  const columns: Column<SaleReturnList>[] = [
    {
      key: 'number',
      header: t('returns.number'),
      render: (r) => <span className="font-medium whitespace-nowrap">{r.number}</span>,
    },
    {
      key: 'date',
      header: t('returns.date'),
      className: 'whitespace-nowrap',
      render: (r) => formatDateTime(r.created_at),
    },
    { key: 'sale', header: t('returns.sale'), render: (r) => r.sale_number },
    ...(branchId === null
      ? [
          {
            key: 'branch',
            header: t('returns.branch'),
            render: (r: SaleReturnList) => r.branch_name,
          },
        ]
      : []),
    { key: 'customer', header: t('returns.customer'), render: (r) => r.customer_name ?? '—' },
    {
      key: 'total',
      header: t('returns.total'),
      className: 'text-right tabular-nums whitespace-nowrap font-medium',
      render: (r) => money(r.total, r),
    },
    {
      key: 'debt',
      header: t('returns.debtReduction'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => money(r.debt_reduction, r),
    },
    {
      key: 'refund',
      header: t('returns.refund'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => money(r.refund_amount, r),
    },
    { key: 'reason', header: t('returns.reason'), render: (r) => r.reason },
    { key: 'by', header: t('returns.by'), render: (r) => r.created_by_name },
  ]

  return (
    <div>
      <PageHeader title={t('returns.title')} />
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('returns.searchPlaceholder')}
          className="w-full sm:w-72"
        />
        <Input
          type="date"
          value={params.date_from ?? ''}
          onChange={(e) => set({ date_from: e.target.value })}
          className="w-full sm:w-40"
          aria-label={t('list.dateFrom')}
        />
        <Input
          type="date"
          value={params.date_to ?? ''}
          onChange={(e) => set({ date_to: e.target.value })}
          className="w-full sm:w-40"
          aria-label={t('list.dateTo')}
        />
      </div>
      <DataTable
        columns={columns}
        rows={returns.data?.results}
        rowKey={(r) => r.id}
        loading={returns.isFetching}
        emptyText={t('returns.empty')}
        onRowClick={(r) => navigate(`/sales/returns/${r.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={returns.data?.total_pages ?? 1}
          count={returns.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
