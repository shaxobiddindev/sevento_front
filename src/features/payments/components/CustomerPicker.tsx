import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useActiveCurrencies } from '@/features/currency'
import type { Customer } from '@/shared/api/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { Combobox } from '@/shared/ui'

import { useCustomers } from '../api/payments.api'
import { formatBalances } from '../lib/format'

export interface CustomerPickerProps {
  value: Customer | null
  onChange: (customer: Customer | null) => void
  placeholder?: string
  disabled?: boolean
}

/** Mijozni ism, telefon yoki STIR bo'yicha qidirib tanlash (qarzi ko'rinadi). */
export function CustomerPicker({ value, onChange, placeholder, disabled }: CustomerPickerProps) {
  const { t } = useTranslation('payments')
  const { decimals } = useActiveCurrencies()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const customers = useCustomers({ search: debounced, is_active: 'true', page_size: 15 })

  return (
    <Combobox<Customer>
      value={value}
      onChange={onChange}
      options={customers.data?.results ?? []}
      getKey={(c) => c.id}
      getLabel={(c) => (c.phone ? `${c.name} (${c.phone})` : c.name)}
      renderOption={(c) => (
        <div className="flex items-center justify-between gap-3">
          <span>
            {c.name}
            {c.phone && <span className="ml-1 text-xs text-slate-500">{c.phone}</span>}
          </span>
          <span className={c.has_overdue ? 'text-xs text-red-600' : 'text-xs text-slate-500'}>
            {c.balances.length ? formatBalances(c.balances, decimals) : t('customers.noDebt')}
          </span>
        </div>
      )}
      onInputChange={setSearch}
      loading={customers.isFetching}
      placeholder={placeholder ?? t('customers.searchPlaceholder')}
      disabled={disabled}
      aria-label={t('customers.title')}
    />
  )
}
