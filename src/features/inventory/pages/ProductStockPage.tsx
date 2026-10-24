import { ArrowLeft, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { useCapability } from '@/features/auth'
import { useProduct } from '@/features/catalog'
import { useActiveCurrencies } from '@/features/currency'
import type { Batch, StockLevel } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import {
  Badge,
  Button,
  DataTable,
  PageHeader,
  PageSpinner,
  Pagination,
  Select,
  type Column,
} from '@/shared/ui'

import { useBatches, useMovements, useStock } from '../api/inventory.api'
import { MovementsTable } from '../components/MovementsTable'

/** Tovar kartasi: nuqtalar bo'yicha qoldiq, ochiq partiyalar (FIFO), harakatlar. */
export function ProductStockPage() {
  const { id } = useParams()
  const productId = Number(id)
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const canViewCost = useCapability('inventory.view_cost')
  const { base, decimals } = useActiveCurrencies()
  const product = useProduct(id)
  const stock = useStock({ product: productId, page_size: 100 })
  const batches = useBatches({ product: productId, open: 'true', page_size: 100 }, canViewCost)
  const { params, page, set, setPage } = useListParams()
  const movements = useMovements({ product: productId, page, direction: params.direction })

  if (product.isPending) return <PageSpinner />
  const places = product.data?.unit_decimal_places ?? 0
  const unit = product.data?.unit_code ?? ''

  const stockColumns: Column<StockLevel>[] = [
    { key: 'branch', header: t('stock.branch'), render: (s) => s.branch_name },
    {
      key: 'quantity',
      header: t('stock.quantity'),
      className: 'text-right tabular-nums',
      render: (s) => (
        <span className={cn('font-semibold', s.is_below_min && 'text-red-700')}>
          {formatNumber(s.quantity, places)} {unit}
        </span>
      ),
    },
    {
      key: 'min',
      header: t('stock.min'),
      className: 'text-right tabular-nums',
      render: (s) => (
        <span className="inline-flex items-center gap-1">
          {s.is_below_min && <Badge tone="danger">{t('stock.belowMin')}</Badge>}
          {formatNumber(s.effective_min, places)}
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
  ]

  const batchColumns: Column<Batch>[] = [
    { key: 'branch', header: t('stock.branch'), render: (b) => b.branch_name },
    {
      key: 'source',
      header: t('card.batchSource'),
      render: (b) =>
        b.source_type === 'purchase' ? (
          <Link
            to={`/purchasing/purchases/${b.source_id}`}
            className="text-brand-700 hover:underline"
          >
            {b.source_number || `#${b.source_id}`}
          </Link>
        ) : (
          b.source_number || `${b.source_type} #${b.source_id}`
        ),
    },
    { key: 'date', header: t('card.batchDate'), render: (b) => formatDate(b.received_at) },
    {
      key: 'initial',
      header: t('card.batchInitial'),
      className: 'text-right tabular-nums',
      render: (b) => formatNumber(b.quantity_initial, places),
    },
    {
      key: 'remaining',
      header: t('card.batchRemaining'),
      className: 'text-right tabular-nums font-semibold',
      render: (b) => formatNumber(b.quantity_remaining, places),
    },
    {
      key: 'cost',
      header: t('card.batchCost', { base }),
      className: 'text-right tabular-nums',
      render: (b) => formatNumber(b.unit_cost_base, 4),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={product.data?.name ?? t('card.title')}
        subtitle={product.data ? `${product.data.sku} · ${t('card.title')}` : undefined}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Package className="size-4" />}
              onClick={() => navigate(`/catalog/products/${productId}`)}
            >
              {t('card.toProduct')}
            </Button>
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

      <section>
        <h2 className="mb-2 text-base font-semibold">{t('card.byBranch')}</h2>
        <DataTable
          columns={stockColumns}
          rows={stock.data?.results}
          rowKey={(s) => s.id}
          loading={stock.isFetching}
          emptyText={t('stock.empty')}
        />
      </section>

      {canViewCost && (
        <section>
          <h2 className="mb-2 text-base font-semibold">{t('card.batches')}</h2>
          <DataTable
            columns={batchColumns}
            rows={batches.data?.results}
            rowKey={(b) => b.id}
            loading={batches.isFetching}
            emptyText={t('card.noBatches')}
          />
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('movements.title')}</h2>
          <Select
            value={params.direction ?? ''}
            onChange={(e) => set({ direction: e.target.value })}
            className="w-full sm:w-40"
            aria-label={t('movements.direction')}
          >
            <option value="">{t('movements.both')}</option>
            <option value="in">{t('movements.in')}</option>
            <option value="out">{t('movements.out')}</option>
          </Select>
        </div>
        <MovementsTable
          rows={movements.data?.results}
          loading={movements.isFetching}
          showProduct={false}
          showCost={canViewCost}
          base={base}
        />
        <div className="mt-3">
          <Pagination
            page={page}
            totalPages={movements.data?.total_pages ?? 1}
            count={movements.data?.count ?? 0}
            onChange={setPage}
          />
        </div>
      </section>
    </div>
  )
}
