import { useQueryClient } from '@tanstack/react-query'
import { Plus, ScanBarcode } from 'lucide-react'
import { useState, type KeyboardEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { queryKeys } from '@/shared/api/queryKeys'
import type { PosProduct } from '@/shared/api/types'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/money'
import { Input, Spinner, toast } from '@/shared/ui'

import { salesApi, usePosProducts, type PosQuery } from '../api/sales.api'

const BARCODE_RE = /^\d{6,}$/

interface Props {
  context: Omit<PosQuery, 'search' | 'barcode' | 'ids'>
  places: number
  inputRef: RefObject<HTMLInputElement | null>
  onAdd: (product: PosProduct) => void
}

/** Qidiruv + shtrix-kod skaneri (skaner raqamlarni tez yozib Enter bosadi). */
export function ProductSearch({ context, places, inputRef, onAdd }: Props) {
  const { t } = useTranslation('sales')
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const search = useDebounce(text.trim(), 250)
  // matn tozalansa ro'yxat darhol yopiladi (debounce kutilmaydi)
  const enabled = text.trim().length >= 2 && search.length >= 2 && !BARCODE_RE.test(search)
  const results = usePosProducts(enabled ? { ...context, search, limit: 12 } : null)
  const rows = enabled ? (results.data ?? []) : []

  const add = (product: PosProduct) => {
    if (product.price === null) {
      toast.warning(t('pos.noPrice'), product.name)
      return
    }
    onAdd(product)
    setText('')
    setActive(0)
    inputRef.current?.focus()
  }

  const scan = async (code: string) => {
    const query = { ...context, barcode: code }
    const found = await qc.fetchQuery({
      queryKey: queryKeys.sales.pos(query),
      queryFn: () => salesApi.pos(query),
      staleTime: 0,
    })
    if (found.length === 1) add(found[0])
    else {
      toast.warning(t('pos.notFound', { query: code }))
      setText('')
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const value = text.trim()
      if (BARCODE_RE.test(value)) void scan(value)
      else if (rows[active]) add(rows[active])
    } else if (event.key === 'Escape') {
      setText('')
    }
  }

  return (
    <div>
      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" />
        <Input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={t('pos.searchPlaceholder')}
          className="h-12 pl-11 text-base"
          aria-label={t('pos.searchPlaceholder')}
          data-testid="pos-search"
        />
        {results.isFetching && enabled && (
          <Spinner className="absolute top-1/2 right-3 size-5 -translate-y-1/2" />
        )}
      </div>
      {enabled && (
        <ul
          className="mt-2 max-h-80 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 bg-white"
          role="listbox"
          data-testid="pos-results"
        >
          {rows.length === 0 && !results.isFetching && (
            <li className="px-3 py-3 text-sm text-slate-500">
              {t('pos.notFound', { query: search })}
            </li>
          )}
          {rows.map((p, index) => {
            const stock = Number(p.stock)
            return (
              <li key={p.id} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(p)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-left text-sm',
                    index === active ? 'bg-brand-50' : 'hover:bg-slate-50',
                    p.price === null && 'opacity-60',
                  )}
                  data-testid={`pos-result-${p.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.sku}
                      {p.barcode && ` · ${p.barcode}`}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'w-24 text-right text-xs tabular-nums',
                      stock > 0 ? 'text-slate-600' : 'font-semibold text-red-600',
                    )}
                    data-testid={`pos-stock-${p.id}`}
                  >
                    {stock > 0
                      ? `${formatNumber(p.stock, p.unit_decimal_places)} ${p.unit_code}`
                      : t('pos.outOfStock')}
                  </div>
                  <div className="w-28 text-right font-semibold tabular-nums">
                    {p.price === null ? t('pos.noPrice') : formatNumber(p.price, places)}
                  </div>
                  <Plus className="size-4 text-slate-400" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {!enabled && <p className="mt-2 text-xs text-slate-400">{t('pos.searchHint')}</p>}
    </div>
  )
}
