import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { Debt } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { DataTable, type Column } from '@/shared/ui'

import { DebtStatusBadge } from './DebtStatusBadge'

export function DebtsTable({
  rows,
  loading,
  showCustomer = true,
}: {
  rows: Debt[] | undefined
  loading?: boolean
  showCustomer?: boolean
}) {
  const { t } = useTranslation('payments')
  const money = (d: Debt, v: string) =>
    `${formatNumber(v, d.currency_decimal_places)} ${d.currency_code}`
  const columns: Column<Debt>[] = [
    ...(showCustomer
      ? [
          {
            key: 'customer',
            header: t('debts.customer'),
            render: (d: Debt) => (
              <Link
                to={`/customers/${d.customer}`}
                className="font-medium hover:text-brand-700 hover:underline"
              >
                {d.customer_name}
                {d.customer_phone && (
                  <span className="ml-1 text-xs text-slate-500">{d.customer_phone}</span>
                )}
              </Link>
            ),
          },
        ]
      : []),
    {
      key: 'doc',
      header: t('debts.document'),
      render: (d) =>
        d.document_type === 'sale' ? (
          <Link to={`/sales/${d.document_id}`} className="text-brand-700 hover:underline">
            {d.document_number}
          </Link>
        ) : (
          d.document_number
        ),
    },
    { key: 'branch', header: t('debts.branch'), render: (d) => d.branch_name },
    {
      key: 'amount',
      header: t('debts.amount'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (d) => money(d, d.amount),
    },
    {
      key: 'paid',
      header: t('debts.paid'),
      className: 'text-right tabular-nums text-slate-500 whitespace-nowrap',
      render: (d) => formatNumber(d.paid_amount, d.currency_decimal_places),
    },
    {
      key: 'remaining',
      header: t('debts.remaining'),
      className: 'text-right tabular-nums font-semibold whitespace-nowrap',
      render: (d) => <span data-testid={`debt-remaining-${d.id}`}>{money(d, d.remaining)}</span>,
    },
    {
      key: 'due',
      header: t('debts.dueDate'),
      className: 'whitespace-nowrap',
      render: (d) => (
        <span className={cn(d.is_overdue && 'font-medium text-red-700')}>
          {formatDate(d.due_date)}
          {d.is_overdue && (
            <span className="ml-1 text-xs">
              ({t('debts.daysOverdue', { days: d.days_overdue })})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('debts.status'),
      render: (d) => <DebtStatusBadge status={d.status} overdue={d.is_overdue} />,
    },
  ]
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(d) => d.id}
      loading={loading}
      emptyText={t('debts.empty')}
    />
  )
}
