import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { Customer } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatNumber } from '@/shared/lib/money'
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  type Column,
} from '@/shared/ui'

import { useCustomers } from '../api/payments.api'
import { CustomerFormModal } from '../components/CustomerFormModal'
import { formatBalances } from '../lib/format'

export function CustomersPage() {
  const { t } = useTranslation('payments')
  const navigate = useNavigate()
  const canManage = useCapability('customers.manage')
  const { base, decimals } = useActiveCurrencies()
  const { params, page, set, setPage } = useListParams()
  const [creating, setCreating] = useState(false)
  const customers = useCustomers({
    page,
    search: params.search,
    has_debt: params.debtors ? 'true' : undefined,
    overdue: params.overdue ? 'true' : undefined,
  })

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: t('customers.name'),
      render: (c) => (
        <div>
          <div className="font-medium">{c.name}</div>
          <div className="text-xs text-slate-500">{c.phone}</div>
        </div>
      ),
    },
    {
      key: 'debt',
      header: t('customers.debt'),
      className: 'text-right tabular-nums',
      render: (c) => (
        <span
          className={c.has_overdue ? 'font-semibold text-red-700' : ''}
          data-testid={`customer-debt-${c.id}`}
        >
          {formatBalances(c.balances, decimals)}
        </span>
      ),
    },
    {
      key: 'debtBase',
      header: t('customers.debtBase', { base }),
      className: 'text-right tabular-nums',
      render: (c) => (Number(c.debt_base) ? formatNumber(c.debt_base, decimals[base] ?? 2) : '—'),
    },
    {
      key: 'limit',
      header: t('customers.limit'),
      className: 'text-right tabular-nums text-slate-500',
      render: (c) => formatNumber(c.effective_credit_limit, decimals[base] ?? 2),
    },
    {
      key: 'flags',
      header: '',
      render: (c) => c.has_overdue && <Badge tone="danger">{t('customers.overdue')}</Badge>,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        actions={
          canManage && (
            <Button
              icon={<Plus className="size-4" />}
              onClick={() => setCreating(true)}
              data-testid="customer-new"
            >
              {t('customers.new')}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('customers.searchPlaceholder')}
          className="w-full sm:w-72"
        />
        <Checkbox
          label={t('customers.onlyDebtors')}
          checked={!!params.debtors}
          onChange={(e) => set({ debtors: e.target.checked ? '1' : null })}
        />
        <Checkbox
          label={t('customers.onlyOverdue')}
          checked={!!params.overdue}
          onChange={(e) => set({ overdue: e.target.checked ? '1' : null })}
        />
      </div>
      <DataTable
        columns={columns}
        rows={customers.data?.results}
        rowKey={(c) => c.id}
        loading={customers.isFetching}
        emptyText={t('customers.empty')}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={customers.data?.total_pages ?? 1}
          count={customers.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
      <CustomerFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => navigate(`/customers/${c.id}`)}
      />
    </div>
  )
}
