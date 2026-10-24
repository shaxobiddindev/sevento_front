import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { flattenTree, indentLabel, useCategoryTree } from '@/features/catalog'
import { useActiveCurrencies } from '@/features/currency'
import type { StockCountList } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDateTime } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import {
  Button,
  Checkbox,
  DataTable,
  FormField,
  Modal,
  PageHeader,
  Pagination,
  Select,
  Textarea,
  toast,
  type Column,
} from '@/shared/ui'

import { useCounts, useCreateCount } from '../api/documents.api'
import { CountStatusBadge } from '../components/DocStatusBadge'

export function StockCountsPage() {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const canManage = useCapability('inventory.counts.manage')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const { base, decimals } = useActiveCurrencies()
  const { params, page, set, setPage } = useListParams()
  const counts = useCounts({ page, status: params.status, branch: branchId ?? undefined })
  const [creating, setCreating] = useState(false)
  const baseDp = decimals[base] ?? 2

  const columns: Column<StockCountList>[] = [
    {
      key: 'number',
      header: t('doc.number'),
      render: (c) => <span className="font-medium whitespace-nowrap">{c.number}</span>,
    },
    {
      key: 'date',
      header: t('doc.date'),
      className: 'whitespace-nowrap',
      render: (c) => formatDateTime(c.completed_at ?? c.created_at),
    },
    { key: 'branch', header: t('counts.branch'), render: (c) => c.branch_name },
    {
      key: 'category',
      header: t('counts.category'),
      render: (c) => c.category_name ?? t('counts.allCategories'),
    },
    {
      key: 'progress',
      header: t('counts.counted'),
      className: 'tabular-nums',
      render: (c) => `${c.counted_count} / ${c.items_count}`,
    },
    {
      key: 'diff',
      header: `${t('counts.surplus')} / ${t('counts.shortage')}`,
      className: 'tabular-nums whitespace-nowrap',
      render: (c) =>
        c.status !== 'completed' || c.surplus_cost_base === undefined ? (
          '—'
        ) : (
          <span>
            <span className="text-emerald-700">
              +{formatMoney(c.surplus_cost_base, base, baseDp)}
            </span>{' '}
            /{' '}
            <span className="text-red-700">
              −{formatMoney(c.shortage_cost_base ?? '0', base, baseDp)}
            </span>
          </span>
        ),
    },
    {
      key: 'status',
      header: t('doc.status'),
      render: (c) => <CountStatusBadge status={c.status} />,
    },
    { key: 'by', header: t('doc.createdBy'), render: (c) => c.created_by_name ?? '—' },
  ]

  return (
    <div>
      <PageHeader
        title={t('counts.title')}
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              {t('counts.new')}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          value={params.status ?? ''}
          onChange={(e) => set({ status: e.target.value })}
          className="w-full sm:w-48"
          aria-label={t('doc.status')}
        >
          <option value="">{t('doc.allStatuses')}</option>
          {(['draft', 'completed', 'cancelled'] as const).map((s) => (
            <option key={s} value={s}>
              {t(`counts.status.${s}`)}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={counts.data?.results}
        rowKey={(c) => c.id}
        loading={counts.isFetching}
        emptyText={t('counts.empty')}
        onRowClick={(c) => navigate(`/inventory/counts/${c.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={counts.data?.total_pages ?? 1}
          count={counts.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
      {creating && (
        <CreateCountModal
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/inventory/counts/${id}`)}
        />
      )}
    </div>
  )
}

function CreateCountModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: number) => void
}) {
  const { t } = useTranslation('inventory')
  const user = useAuthStore((s) => s.user)
  const currentBranchId = useAuthStore((s) => s.currentBranchId)
  const tree = useCategoryTree()
  const categories = useMemo(() => flattenTree(tree.data ?? []), [tree.data])
  const create = useCreateCount()
  const [branch, setBranch] = useState(String(currentBranchId ?? user?.branches[0]?.id ?? ''))
  const [category, setCategory] = useState('')
  const [includeZero, setIncludeZero] = useState(false)
  const [note, setNote] = useState('')

  const onSubmit = () =>
    create.mutate(
      {
        branch: Number(branch),
        category: category ? Number(category) : null,
        include_zero: includeZero,
        note,
      },
      {
        onSuccess: (count) => {
          toast.success(t('counts.created'))
          onCreated(count.id)
        },
        onError: (error) => toast.error(error.message),
      },
    )

  return (
    <Modal
      open
      onClose={onClose}
      title={t('counts.new')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('doc.close')}
          </Button>
          <Button loading={create.isPending} onClick={onSubmit} data-testid="count-create">
            {t('counts.new')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{t('counts.createHint')}</p>
        <FormField label={t('counts.branch')} required>
          <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
            {user?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('counts.category')}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('counts.allCategories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {indentLabel(c)}
              </option>
            ))}
          </Select>
        </FormField>
        <Checkbox
          checked={includeZero}
          onChange={(e) => setIncludeZero(e.target.checked)}
          label={t('counts.includeZero')}
        />
        <FormField label={t('doc.note')}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
