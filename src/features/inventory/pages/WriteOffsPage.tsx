import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { WriteOffList } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDateTime } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import {
  Button,
  DataTable,
  Input,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/shared/ui'

import { useWriteOffReasons, useWriteOffs } from '../api/documents.api'
import { WriteOffStatusBadge } from '../components/DocStatusBadge'

export function WriteOffsPage() {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const canManage = useCapability('inventory.writeoffs.manage')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const { base, decimals } = useActiveCurrencies()
  const reasons = useWriteOffReasons()
  const { params, page, set, setPage } = useListParams()
  const writeOffs = useWriteOffs({
    page,
    search: params.search,
    reason: params.reason,
    status: params.status,
    date_from: params.date_from,
    date_to: params.date_to,
    branch: branchId ?? undefined,
  })

  const columns: Column<WriteOffList>[] = [
    {
      key: 'number',
      header: t('doc.number'),
      render: (w) => <span className="font-medium whitespace-nowrap">{w.number}</span>,
    },
    {
      key: 'date',
      header: t('doc.date'),
      className: 'whitespace-nowrap',
      render: (w) => formatDateTime(w.completed_at),
    },
    { key: 'branch', header: t('writeOffs.branch'), render: (w) => w.branch_name },
    {
      key: 'reason',
      header: t('writeOffs.reason'),
      render: (w) => (
        <span>
          {w.reason_name}
          {w.transfer_number && (
            <span className="ml-1 text-xs text-slate-500">({w.transfer_number})</span>
          )}
        </span>
      ),
    },
    { key: 'items', header: t('doc.itemsCount'), render: (w) => w.items_count },
    ...(writeOffs.data?.results[0]?.total_cost_base !== undefined
      ? [
          {
            key: 'cost',
            header: t('doc.totalCost', { base }),
            className: 'text-right tabular-nums whitespace-nowrap',
            render: (w: WriteOffList) =>
              formatMoney(w.total_cost_base ?? '0', base, decimals[base] ?? 2),
          },
        ]
      : []),
    {
      key: 'status',
      header: t('doc.status'),
      render: (w) => <WriteOffStatusBadge status={w.status} />,
    },
    { key: 'by', header: t('doc.createdBy'), render: (w) => w.created_by_name ?? '—' },
  ]

  return (
    <div>
      <PageHeader
        title={t('writeOffs.title')}
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => navigate('/inventory/write-offs/new')}
            >
              {t('writeOffs.new')}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          value={params.reason ?? ''}
          onChange={(e) => set({ reason: e.target.value })}
          className="w-full sm:w-56"
          aria-label={t('writeOffs.reason')}
        >
          <option value="">{t('writeOffs.allReasons')}</option>
          {reasons.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select
          value={params.status ?? ''}
          onChange={(e) => set({ status: e.target.value })}
          className="w-full sm:w-44"
          aria-label={t('doc.status')}
        >
          <option value="">{t('doc.allStatuses')}</option>
          <option value="completed">{t('writeOffs.status.completed')}</option>
          <option value="cancelled">{t('writeOffs.status.cancelled')}</option>
        </Select>
        <Input
          type="date"
          value={params.date_from ?? ''}
          onChange={(e) => set({ date_from: e.target.value })}
          className="w-full sm:w-40"
          aria-label={t('doc.dateFrom')}
        />
        <Input
          type="date"
          value={params.date_to ?? ''}
          onChange={(e) => set({ date_to: e.target.value })}
          className="w-full sm:w-40"
          aria-label={t('doc.dateTo')}
        />
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('doc.searchNumber')}
          className="w-full sm:w-56"
        />
      </div>
      <DataTable
        columns={columns}
        rows={writeOffs.data?.results}
        rowKey={(w) => w.id}
        loading={writeOffs.isFetching}
        emptyText={t('writeOffs.empty')}
        onRowClick={(w) => navigate(`/inventory/write-offs/${w.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={writeOffs.data?.total_pages ?? 1}
          count={writeOffs.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
