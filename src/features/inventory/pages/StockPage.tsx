import { SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { flattenTree, indentLabel, useCategoryTree } from '@/features/catalog'
import { useActiveCurrencies } from '@/features/currency'
import type { StockLevel } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/shared/ui'

import { useStock } from '../api/inventory.api'
import { MinQuantityModal } from '../components/MinQuantityModal'

const qty = (value: string, places: number) => formatNumber(value, places)

export function StockPage() {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const branchId = useAuthStore((s) => s.currentBranchId)
  const canViewCost = useCapability('inventory.view_cost')
  const canManage = useCapability('inventory.manage')
  const { base, decimals } = useActiveCurrencies()
  const tree = useCategoryTree()
  const flat = useMemo(() => flattenTree(tree.data ?? []), [tree.data])
  const { params, page, set, setPage } = useListParams()
  const [editing, setEditing] = useState<StockLevel | null>(null)
  const stock = useStock({
    page,
    search: params.search,
    category: params.category,
    below_minimum: params.below ? 'true' : undefined,
    in_stock: params.in_stock,
    branch: branchId ?? undefined,
  })

  const columns: Column<StockLevel>[] = [
    {
      key: 'product',
      header: t('stock.product'),
      render: (s) => (
        <div>
          <div className="font-medium">{s.product_name}</div>
          <div className="text-xs text-slate-500">
            {s.product_sku}
            {s.category_name && ` · ${s.category_name}`}
          </div>
        </div>
      ),
    },
    ...(branchId === null
      ? [{ key: 'branch', header: t('stock.branch'), render: (s: StockLevel) => s.branch_name }]
      : []),
    {
      key: 'quantity',
      header: t('stock.quantity'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (s) => (
        <span
          className={cn('font-semibold', s.is_below_min && 'text-red-700')}
          data-testid={`qty-${s.product}-${s.branch}`}
        >
          {qty(s.quantity, s.unit_decimal_places)} {s.unit_code}
        </span>
      ),
    },
    {
      key: 'min',
      header: t('stock.min'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (s) => (
        <span className="inline-flex items-center gap-1">
          {s.is_below_min && <Badge tone="danger">{t('stock.belowMin')}</Badge>}
          <span className={cn(s.min_quantity === null && 'text-slate-400')}>
            {qty(s.effective_min, s.unit_decimal_places)}
          </span>
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              icon={<SlidersHorizontal className="size-3.5" />}
              onClick={(e) => {
                e.stopPropagation()
                setEditing(s)
              }}
              aria-label={t('min.title')}
              className="h-6 px-1"
            />
          )}
        </span>
      ),
    },
    ...(canViewCost
      ? [
          {
            key: 'value',
            header: t('stock.value', { base }),
            className: 'text-right tabular-nums',
            render: (s: StockLevel) => formatNumber(s.value_base ?? '0', decimals[base] ?? 2),
          },
        ]
      : []),
    {
      key: 'updated',
      header: t('stock.updated'),
      className: 'whitespace-nowrap text-slate-500',
      render: (s) => formatDateTime(s.updated_at),
    },
  ]

  return (
    <div>
      <PageHeader title={t('stock.title')} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('stock.searchPlaceholder')}
          className="w-full sm:w-72"
        />
        <Select
          value={params.category ?? ''}
          onChange={(e) => set({ category: e.target.value })}
          className="w-full sm:w-56"
          aria-label={t('stock.allCategories')}
        >
          <option value="">{t('stock.allCategories')}</option>
          {flat.map((c) => (
            <option key={c.id} value={c.id}>
              {indentLabel(c)}
            </option>
          ))}
        </Select>
        <Select
          value={params.in_stock ?? ''}
          onChange={(e) => set({ in_stock: e.target.value })}
          className="w-full sm:w-36"
        >
          <option value="">{t('stock.allStock')}</option>
          <option value="true">{t('stock.inStock')}</option>
          <option value="false">{t('stock.outOfStock')}</option>
        </Select>
        <Checkbox
          label={t('stock.onlyBelowMin')}
          checked={!!params.below}
          onChange={(e) => set({ below: e.target.checked ? '1' : null })}
        />
      </div>
      <DataTable
        columns={columns}
        rows={stock.data?.results}
        rowKey={(s) => s.id}
        loading={stock.isFetching}
        emptyText={t('stock.empty')}
        onRowClick={(s) => navigate(`/inventory/products/${s.product}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={stock.data?.total_pages ?? 1}
          count={stock.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
      <MinQuantityModal level={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
