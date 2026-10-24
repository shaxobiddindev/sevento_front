import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth'
import { useListParams } from '@/shared/hooks/useListParams'
import { Checkbox, PageHeader, Pagination, SearchInput, Select } from '@/shared/ui'

import { useDebts } from '../api/payments.api'
import { DebtsTable } from '../components/DebtsTable'

/** Barcha qarzlar (nuqta bo'yicha), muddati o'tganlar alohida filtr bilan. */
export function DebtsPage() {
  const { t } = useTranslation('payments')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const { params, page, set, setPage } = useListParams()
  const debts = useDebts({
    page,
    search: params.search,
    status: params.status ?? 'open',
    overdue: params.overdue ? 'true' : undefined,
    branch: branchId ?? undefined,
  })

  return (
    <div>
      <PageHeader title={t('debts.title')} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('debts.searchPlaceholder')}
          className="w-full sm:w-72"
        />
        <Select
          value={params.status ?? 'open'}
          onChange={(e) => set({ status: e.target.value })}
          className="w-full sm:w-44"
          aria-label={t('debts.status')}
        >
          <option value="open">{t('debts.statuses.open')}</option>
          <option value="paid">{t('debts.statuses.paid')}</option>
          <option value="cancelled">{t('debts.statuses.cancelled')}</option>
          <option value="">{t('debts.allStatuses')}</option>
        </Select>
        <Checkbox
          label={t('debts.onlyOverdue')}
          checked={!!params.overdue}
          onChange={(e) => set({ overdue: e.target.checked ? '1' : null })}
        />
      </div>
      <DebtsTable rows={debts.data?.results} loading={debts.isFetching} />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={debts.data?.total_pages ?? 1}
          count={debts.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
