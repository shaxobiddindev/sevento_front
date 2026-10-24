import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth'
import { flattenTree, indentLabel, useCategoryTree } from '@/features/catalog'
import { useActiveCurrencies } from '@/features/currency'
import { useWriteOffReasons } from '@/features/inventory'
import { usePaymentMethods } from '@/features/payments'
import { useSuppliers } from '@/features/purchasing'
import type { ReportFilter } from '@/shared/api/types'
import { Checkbox, FormField, Input, Select } from '@/shared/ui'

import { ALL, periodPresets } from '../lib/params'

/**
 * Filtr formasi hisobot ta'rifidan (backend `filters`) quriladi — yangi hisobot qo'shilganda
 * frontend kodi o'zgarmaydi. Qiymatlar URL da (havola ulashilsa ham saqlanadi).
 */
export function ReportFilters({
  filters,
  values,
  onChange,
}: {
  filters: ReportFilter[]
  values: Record<string, string>
  onChange: (changes: Record<string, string>) => void
}) {
  const { t } = useTranslation('reports')
  const hasPeriod = filters.some((f) => f.name === 'date_from')

  return (
    <div className="space-y-3">
      {hasPeriod && (
        <div className="flex flex-wrap gap-1">
          {periodPresets().map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ date_from: p.from, date_to: p.to })}
              className={
                values.date_from === p.from && values.date_to === p.to
                  ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white'
                  : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200'
              }
            >
              {t(`periods.${p.key}`)}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filters.map((f) => (
          <FilterField
            key={f.name}
            filter={f}
            value={values[f.name] ?? ''}
            onChange={(v) => onChange({ [f.name]: v })}
          />
        ))}
      </div>
    </div>
  )
}

function FilterField({
  filter,
  value,
  onChange,
}: {
  filter: ReportFilter
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('reports')
  const id = `report-filter-${filter.name}`
  if (filter.type === 'bool') {
    return (
      <div className="flex items-end pb-2">
        <Checkbox
          id={id}
          checked={value === 'true'}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
          label={filter.label}
        />
      </div>
    )
  }
  return (
    <FormField label={filter.label} htmlFor={id}>
      {filter.type === 'date' ? (
        <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Select
          id={id}
          value={filter.type === 'branch' && !value ? ALL : value}
          onChange={(e) => onChange(e.target.value)}
        >
          {filter.type === 'branch' ? (
            <option value={ALL}>{t('allBranches')}</option>
          ) : filter.type !== 'choice' || !filter.default ? (
            <option value="">{t('all')}</option>
          ) : null}
          <FilterOptions filter={filter} />
        </Select>
      )}
    </FormField>
  )
}

/** Ma'lumotnomali filtrlar variantlari (faqat kerakli so'rov yuboriladi). */
function FilterOptions({ filter }: { filter: ReportFilter }) {
  switch (filter.type) {
    case 'branch':
      return <BranchOptions />
    case 'category':
      return <CategoryOptions />
    case 'supplier':
      return <SupplierOptions />
    case 'write_off_reason':
      return <ReasonOptions />
    case 'payment_method':
      return <MethodOptions />
    case 'currency':
      return <CurrencyOptions />
    default:
      return (
        <>
          {filter.choices.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </>
      )
  }
}

function BranchOptions() {
  const branches = useAuthStore((s) => s.user?.branches ?? [])
  return (
    <>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </>
  )
}

function CategoryOptions() {
  const tree = useCategoryTree()
  const flat = useMemo(() => flattenTree(tree.data ?? []), [tree.data])
  return (
    <>
      {flat.map((c) => (
        <option key={c.id} value={c.id}>
          {indentLabel(c)}
        </option>
      ))}
    </>
  )
}

function SupplierOptions() {
  const suppliers = useSuppliers({ page_size: 200, ordering: 'name' })
  return (
    <>
      {suppliers.data?.results.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </>
  )
}

function ReasonOptions() {
  const reasons = useWriteOffReasons()
  return (
    <>
      {reasons.data?.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </>
  )
}

function MethodOptions() {
  const methods = usePaymentMethods()
  return (
    <>
      {methods.data?.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </>
  )
}

function CurrencyOptions() {
  const { currencies } = useActiveCurrencies()
  return (
    <>
      {currencies.map((c) => (
        <option key={c.id} value={c.code}>
          {c.code}
        </option>
      ))}
    </>
  )
}
