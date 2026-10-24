import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { StockMovement } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { DataTable, type Column } from '@/shared/ui'
import { documentRoute } from '@/shared/lib/documentRoutes'

/** Hujjat turi → frontend sahifasi (keyingi bosqichlarda savdo, ko'chirish qo'shiladi). */

export function MovementsTable({
  rows,
  loading,
  showProduct = true,
  showBranch = true,
  showCost,
  base,
}: {
  rows: StockMovement[] | undefined
  loading: boolean
  showProduct?: boolean
  showBranch?: boolean
  showCost: boolean
  base: string
}) {
  const { t } = useTranslation('inventory')

  const columns: Column<StockMovement>[] = [
    {
      key: 'date',
      header: t('movements.date'),
      className: 'whitespace-nowrap',
      render: (m) => formatDateTime(m.created_at),
    },
    {
      key: 'type',
      header: t('movements.type'),
      render: (m) => t(`types.${m.type}`, { defaultValue: m.type_display }),
    },
    ...(showProduct
      ? [
          {
            key: 'product',
            header: t('movements.product'),
            render: (m: StockMovement) => (
              <Link
                to={`/inventory/products/${m.product}`}
                className="hover:text-brand-700 hover:underline"
              >
                {m.product_name}
              </Link>
            ),
          },
        ]
      : []),
    ...(showBranch
      ? [
          {
            key: 'branch',
            header: t('movements.branch'),
            render: (m: StockMovement) => m.branch_name,
          },
        ]
      : []),
    {
      key: 'qty',
      header: t('movements.quantity'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (m) => {
        const n = Number(m.quantity)
        return (
          <span className={cn(n > 0 ? 'text-emerald-700' : 'text-red-700')}>
            {n > 0 ? '+' : ''}
            {formatNumber(m.quantity, 3).replace(/,?0+$/, '')} {m.unit_code}
          </span>
        )
      },
    },
    {
      key: 'balance',
      header: t('movements.balance'),
      className: 'text-right tabular-nums',
      render: (m) => formatNumber(m.balance_after, 3).replace(/,?0+$/, ''),
    },
    ...(showCost
      ? [
          {
            key: 'cost',
            header: t('movements.cost', { base }),
            className: 'text-right tabular-nums',
            render: (m: StockMovement) => formatNumber(m.total_cost_base ?? '0', 2),
          },
        ]
      : []),
    {
      key: 'doc',
      header: t('movements.document'),
      className: 'whitespace-nowrap',
      render: (m) => {
        const route = documentRoute(m.document_type, m.document_id)
        const label = m.document_number || `${m.document_type} #${m.document_id}`
        return route ? (
          <Link to={route} className="text-brand-700 hover:underline">
            {label}
          </Link>
        ) : (
          label
        )
      },
    },
    { key: 'by', header: t('movements.by'), render: (m) => m.created_by_name ?? '—' },
  ]

  return <DataTable columns={columns} rows={rows} rowKey={(m) => m.id} loading={loading} />
}
