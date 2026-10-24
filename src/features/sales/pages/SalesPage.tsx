import { ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { SaleList } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import {
  Button,
  Checkbox,
  DataTable,
  FormField,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/shared/ui'

import { useSales } from '../api/sales.api'
import { SaleStatusBadge } from '../components/SaleStatusBadge'

export function SalesPage() {
  const { t } = useTranslation('sales')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const branchId = useAuthStore((s) => s.currentBranchId)
  const canSell = useCapability('sales.create')
  const canViewCost = useCapability('inventory.view_cost')
  const { base, decimals } = useActiveCurrencies()
  const { params, page, set, setPage } = useListParams()
  const sales = useSales({
    page,
    search: params.search,
    status: params.status,
    date_from: params.date_from,
    date_to: params.date_to,
    customer: params.customer,
    on_credit: params.credit ? 'true' : undefined,
    branch: branchId ?? undefined,
  })

  const columns: Column<SaleList>[] = [
    {
      key: 'number',
      header: t('list.number'),
      render: (s) => <span className="font-medium">{s.number}</span>,
    },
    {
      key: 'date',
      header: t('list.date'),
      className: 'whitespace-nowrap',
      render: (s) => formatDateTime(s.completed_at),
    },
    ...(branchId === null
      ? [{ key: 'branch', header: t('list.branch'), render: (s: SaleList) => s.branch_name }]
      : []),
    { key: 'seller', header: t('list.seller'), render: (s) => s.seller_name },
    {
      key: 'customer',
      header: t('list.customer'),
      render: (s) =>
        s.customer_name ? (
          <span>
            {s.customer_name}
            {Number(s.debt_amount) > 0 && (
              <span className="ml-1 text-xs font-medium text-amber-700">
                ({t('list.debt')}: {formatNumber(s.debt_amount, s.currency_decimal_places)})
              </span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'items',
      header: t('list.items'),
      className: 'text-right',
      render: (s) => s.items_count,
    },
    {
      key: 'total',
      header: t('list.total'),
      className: 'text-right tabular-nums whitespace-nowrap font-semibold',
      render: (s) => `${formatNumber(s.total, s.currency_decimal_places)} ${s.currency_code}`,
    },
    ...(canViewCost
      ? [
          {
            key: 'profit',
            header: t('list.profit', { base }),
            className: 'text-right tabular-nums',
            render: (s: SaleList) => formatNumber(s.profit_base, decimals[base] ?? 2),
          },
        ]
      : []),
    {
      key: 'status',
      header: t('list.status'),
      render: (s) => <SaleStatusBadge status={s.status} returnState={s.return_state} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('list.title')}
        actions={
          canSell && (
            <Button
              icon={<ShoppingCart className="size-4" />}
              onClick={() => navigate('/sales/pos')}
            >
              {t('pos.title')}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FormField label={tc('actions.search')} className="w-full sm:w-64">
          <SearchInput
            value={params.search ?? ''}
            onChange={(v) => set({ search: v })}
            placeholder={t('list.searchPlaceholder')}
          />
        </FormField>
        <FormField label={t('list.status')} className="w-full sm:w-44">
          <Select value={params.status ?? ''} onChange={(e) => set({ status: e.target.value })}>
            <option value="">{t('list.allStatuses')}</option>
            <option value="completed">{t('status.completed')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </Select>
        </FormField>
        <FormField label={t('list.dateFrom')}>
          <Input
            type="date"
            value={params.date_from ?? ''}
            onChange={(e) => set({ date_from: e.target.value })}
          />
        </FormField>
        <Checkbox
          label={t('list.onlyCredit')}
          checked={!!params.credit}
          onChange={(e) => set({ credit: e.target.checked ? '1' : null })}
          className="h-10"
        />
        <FormField label={t('list.dateTo')}>
          <Input
            type="date"
            value={params.date_to ?? ''}
            onChange={(e) => set({ date_to: e.target.value })}
          />
        </FormField>
      </div>
      <DataTable
        columns={columns}
        rows={sales.data?.results}
        rowKey={(s) => s.id}
        loading={sales.isFetching}
        emptyText={t('list.empty')}
        onRowClick={(s) => navigate(`/sales/${s.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={sales.data?.total_pages ?? 1}
          count={sales.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
