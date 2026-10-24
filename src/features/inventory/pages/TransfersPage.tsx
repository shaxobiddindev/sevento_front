import { AlertTriangle, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import type { TransferList } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/date'
import {
  Badge,
  Button,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/shared/ui'

import { useIncomingTransfersCount, useTransfers } from '../api/documents.api'
import { TransferStatusBadge } from '../components/DocStatusBadge'

const DIRECTIONS = ['', 'in', 'out'] as const

/** Ko'chirishlar: kelayotgan / jo'natilgan; holat boshqa nuqtada o'zgarsa jonli yangilanadi. */
export function TransfersPage() {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const canCreate = useCapability('inventory.transfers.create')
  const canReceive = useCapability('inventory.transfers.receive')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const { params, page, set, setPage } = useListParams()
  const transfers = useTransfers({
    page,
    search: params.search,
    status: params.status,
    direction: params.direction,
    has_discrepancy: params.has_discrepancy,
    branch: branchId ?? undefined,
  })
  const incoming = useIncomingTransfersCount(canReceive)
  const waiting = incoming.data?.count ?? 0

  const columns: Column<TransferList>[] = [
    {
      key: 'number',
      header: t('doc.number'),
      render: (r) => <span className="font-medium whitespace-nowrap">{r.number}</span>,
    },
    {
      key: 'date',
      header: t('doc.date'),
      className: 'whitespace-nowrap',
      render: (r) => formatDateTime(r.received_at ?? r.sent_at ?? r.created_at),
    },
    {
      key: 'route',
      header: `${t('transfers.from')} → ${t('transfers.to')}`,
      render: (r) => (
        <span>
          <span className={cn(branchId === r.from_branch && 'font-semibold')}>
            {r.from_branch_name}
          </span>{' '}
          →{' '}
          <span className={cn(branchId === r.to_branch && 'font-semibold')}>
            {r.to_branch_name}
          </span>
        </span>
      ),
    },
    { key: 'items', header: t('doc.itemsCount'), render: (r) => r.items_count },
    {
      key: 'status',
      header: t('doc.status'),
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1" data-testid="transfer-status">
          <TransferStatusBadge status={r.status} />
          {r.has_discrepancy && (
            <Badge tone="danger">
              <AlertTriangle className="mr-1 size-3" />
              {t('transfers.discrepancy')}
            </Badge>
          )}
        </span>
      ),
    },
    { key: 'by', header: t('doc.createdBy'), render: (r) => r.created_by_name ?? '—' },
  ]

  return (
    <div>
      <PageHeader
        title={t('transfers.title')}
        actions={
          canCreate && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => navigate('/inventory/transfers/new')}
            >
              {t('transfers.new')}
            </Button>
          )
        }
      />
      {waiting > 0 && (
        <button
          type="button"
          className="mb-3 w-full rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-left text-sm font-medium text-sky-800 hover:bg-sky-100"
          onClick={() => set({ direction: 'in', status: 'sent' })}
          data-testid="incoming-banner"
        >
          {t('transfers.waiting', { count: waiting })}
        </button>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {DIRECTIONS.map((d) => (
            <button
              key={d || 'all'}
              type="button"
              onClick={() => set({ direction: d })}
              className={cn(
                'px-3 py-1.5',
                (params.direction ?? '') === d
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {d === ''
                ? t('transfers.all')
                : d === 'in'
                  ? t('transfers.incoming')
                  : t('transfers.outgoing')}
            </button>
          ))}
        </div>
        <Select
          value={params.status ?? ''}
          onChange={(e) => set({ status: e.target.value })}
          className="w-full sm:w-44"
          aria-label={t('doc.status')}
        >
          <option value="">{t('doc.allStatuses')}</option>
          {(['draft', 'sent', 'received', 'cancelled'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`transfers.status.${s}`)}
            </option>
          ))}
        </Select>
        <Select
          value={params.has_discrepancy ?? ''}
          onChange={(e) => set({ has_discrepancy: e.target.value })}
          className="w-full sm:w-44"
          aria-label={t('transfers.discrepancy')}
        >
          <option value="">{t('transfers.discrepancyAny')}</option>
          <option value="true">{t('transfers.onlyDiscrepancy')}</option>
        </Select>
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('doc.searchNumber')}
          className="w-full sm:w-56"
        />
      </div>
      <DataTable
        columns={columns}
        rows={transfers.data?.results}
        rowKey={(r) => r.id}
        loading={transfers.isFetching}
        emptyText={t('transfers.empty')}
        onRowClick={(r) => navigate(`/inventory/transfers/${r.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={transfers.data?.total_pages ?? 1}
          count={transfers.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
