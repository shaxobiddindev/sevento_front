import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebounce } from '@/shared/hooks/useDebounce'
import { Combobox } from '@/shared/ui/Combobox'

import { useProducts } from '../api/catalog.api'
import { toPickedProduct, type PickedProduct } from '../lib/picked'

export interface ProductPickerProps {
  value: PickedProduct | null
  onChange: (product: PickedProduct | null) => void
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

/** Faol tovarlarni nomi, artikul yoki shtrix-kod bo'yicha qidirib tanlash. */
export function ProductPicker({
  value,
  onChange,
  invalid,
  disabled,
  autoFocus,
}: ProductPickerProps) {
  const { t } = useTranslation('catalog')
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 250)
  const products = useProducts({ search: debounced, is_active: 'true', page_size: 20 })

  return (
    <Combobox<PickedProduct>
      value={value}
      onChange={onChange}
      options={(products.data?.results ?? []).map(toPickedProduct)}
      getKey={(p) => p.id}
      getLabel={(p) => `${p.name} (${p.sku})`}
      renderOption={(p) => (
        <div className="flex items-center justify-between gap-3">
          <span>{p.name}</span>
          <span className="text-xs text-slate-500">
            {p.sku} · {p.unit_code}
          </span>
        </div>
      )}
      onInputChange={setSearch}
      loading={products.isFetching}
      placeholder={t('products.searchPlaceholder')}
      invalid={invalid}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={t('products.name')}
    />
  )
}
