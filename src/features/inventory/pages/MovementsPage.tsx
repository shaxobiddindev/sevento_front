import { useTranslation } from 'react-i18next'

import { useAuthStore, useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { MovementType } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { Button, FormField, Input, PageHeader, Pagination, SearchInput, Select } from '@/shared/ui'

import { useMovements } from '../api/inventory.api'
import { MovementsTable } from '../components/MovementsTable'

const TYPES: MovementType[] = [
  'purchase_in',
  'purchase_cancel',
  'sale_out',
  'sale_return_in',
  'transfer_out',
  'transfer_in',
  'count_surplus',
  'count_shortage',
  'write_off',
]

export function MovementsPage() {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const branchId = useAuthStore((s) => s.currentBranchId)
  const canViewCost = useCapability('inventory.view_cost')
  const { base } = useActiveCurrencies()
  const { params, page, set, setPage } = useListParams()
  const movements = useMovements({
    page,
    search: params.search,
    type: params.type,
    direction: params.direction,
    date_from: params.date_from,
    date_to: params.date_to,
    branch: branchId ?? undefined,
  })

  return (
    <div>
      <PageHeader title={t('movements.title')} />
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FormField label={tc('actions.search')} className="w-full sm:w-64">
          <SearchInput
            value={params.search ?? ''}
            onChange={(v) => set({ search: v })}
            placeholder={t('movements.searchPlaceholder')}
          />
        </FormField>
        <FormField label={t('movements.type')} className="w-full sm:w-56">
          <Select value={params.type ?? ''} onChange={(e) => set({ type: e.target.value })}>
            <option value="">{t('movements.allTypes')}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('movements.direction')} className="w-full sm:w-36">
          <Select
            value={params.direction ?? ''}
            onChange={(e) => set({ direction: e.target.value })}
          >
            <option value="">{t('movements.both')}</option>
            <option value="in">{t('movements.in')}</option>
            <option value="out">{t('movements.out')}</option>
          </Select>
        </FormField>
        <FormField label={t('movements.dateFrom')}>
          <Input
            type="date"
            value={params.date_from ?? ''}
            onChange={(e) => set({ date_from: e.target.value })}
          />
        </FormField>
        <FormField label={t('movements.dateTo')}>
          <Input
            type="date"
            value={params.date_to ?? ''}
            onChange={(e) => set({ date_to: e.target.value })}
          />
        </FormField>
        <Button
          variant="ghost"
          className="h-10"
          onClick={() =>
            set({ search: null, type: null, direction: null, date_from: null, date_to: null })
          }
        >
          {tc('actions.reset')}
        </Button>
      </div>
      <MovementsTable
        rows={movements.data?.results}
        loading={movements.isFetching}
        showBranch={branchId === null}
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
    </div>
  )
}
