import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { PurchaseList } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import {
  Button,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/shared/ui'

import { usePurchases } from '../api/purchasing.api'
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge'

export function PurchasesPage() {
  const { t } = useTranslation('purchasing')
  const navigate = useNavigate()
  const canManage = useCapability('purchasing.manage')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const { decimals } = useActiveCurrencies()
  const { params, page, set, setPage } = useListParams()
  const purchases = usePurchases({
    page,
    search: params.search,
    status: params.status,
    branch: branchId ?? undefined,
  })

  const columns: Column<PurchaseList>[] = [
    {
      key: 'number',
      header: t('purchases.number'),
      render: (p) => <span className="font-medium whitespace-nowrap">{p.number}</span>,
    },
    {
      key: 'date',
      header: t('purchases.date'),
      render: (p) => formatDate(p.received_at ?? p.created_at),
    },
    { key: 'supplier', header: t('purchases.supplier'), render: (p) => p.supplier_name },
    ...(branchId === null
      ? [
          {
            key: 'branch',
            header: t('purchases.branch'),
            render: (p: PurchaseList) => p.branch_name,
          },
        ]
      : []),
    {
      key: 'invoice',
      header: t('purchases.invoiceNumber'),
      render: (p) => p.invoice_number || '—',
    },
    { key: 'items', header: t('purchases.itemsCount'), render: (p) => p.items_count },
    {
      key: 'subtotal',
      header: t('purchases.subtotal'),
      className: 'tabular-nums whitespace-nowrap',
      render: (p) => formatMoney(p.subtotal, p.currency_code, decimals[p.currency_code] ?? 2),
    },
    {
      key: 'status',
      header: t('purchases.status'),
      render: (p) => <PurchaseStatusBadge status={p.status} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('purchases.title')}
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => navigate('/purchasing/purchases/new')}
            >
              {t('purchases.new')}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('purchases.searchPlaceholder')}
          className="w-full sm:w-80"
        />
        <Select
          value={params.status ?? ''}
          onChange={(e) => set({ status: e.target.value })}
          className="w-full sm:w-48"
          aria-label={t('purchases.status')}
        >
          <option value="">{t('purchases.allStatuses')}</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="received">{t('status.received')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={purchases.data?.results}
        rowKey={(p) => p.id}
        loading={purchases.isFetching}
        onRowClick={(p) => navigate(`/purchasing/purchases/${p.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={purchases.data?.total_pages ?? 1}
          count={purchases.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
