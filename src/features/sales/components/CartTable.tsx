import { Minus, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'
import { formatNumber, parseDecimalInput } from '@/shared/lib/money'
import { Button, EmptyState, Input } from '@/shared/ui'

import { fitsPrecision } from '../lib/cart'
import { lineGross, minorToString, toScaled } from '../lib/money'
import { useCartStore, type CartLine } from '../store/cart'

interface Props {
  places: number
  canDiscount: boolean
  /** server xatosi bilan belgilangan qator (masalan omborda yetmadi) */
  errorLines?: Record<number, string>
}

export function CartTable({ places, canDiscount, errorLines = {} }: Props) {
  const { t } = useTranslation('sales')
  const lines = useCartStore((s) => s.lines)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const setDiscount = useCartStore((s) => s.setDiscount)
  const remove = useCartStore((s) => s.remove)

  if (!lines.length) {
    return <EmptyState text={t('pos.emptyCart')} />
  }

  const step = (line: CartLine, delta: number) => {
    const current = Number(parseDecimalInput(line.quantity)) || 0
    const next = Math.max(current + delta, 0)
    if (next === 0) remove(line.product.id)
    else setQuantity(line.product.id, String(Math.round(next * 1000) / 1000))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm" data-testid="cart">
        <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="w-8 pb-2">#</th>
            <th className="pb-2">{t('pos.product')}</th>
            <th className="w-44 pb-2 text-center">{t('pos.quantity')}</th>
            <th className="w-28 pb-2 text-right">{t('pos.price')}</th>
            {canDiscount && <th className="w-28 pb-2 text-right">{t('pos.discount')}</th>}
            <th className="w-32 pb-2 text-right">{t('pos.lineTotal')}</th>
            <th className="w-10 pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((line, index) => {
            const p = line.product
            const gross = lineGross(line.quantity, p.price ?? '0', places)
            const discount = toScaled(line.discount || '0', places) ?? 0n
            const total = gross === null ? null : gross - discount
            const qty = Number(parseDecimalInput(line.quantity))
            const overStock = qty > Number(p.stock)
            const badPrecision = !fitsPrecision(line.quantity, p.unit_decimal_places)
            const serverError = errorLines[index]
            return (
              <tr key={p.id} className="align-top" data-testid={`cart-line-${p.id}`}>
                <td className="py-2 pr-2 text-slate-400">{index + 1}</td>
                <td className="py-2 pr-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.sku}</div>
                  {(overStock || serverError) && (
                    <div className="mt-0.5 text-xs text-red-600">
                      {serverError ??
                        t('pos.overStock', {
                          stock: formatNumber(p.stock, p.unit_decimal_places),
                          unit: p.unit_code,
                        })}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-2">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Minus className="size-4" />}
                      onClick={() => step(line, -1)}
                      aria-label="-1"
                    />
                    <Input
                      value={line.quantity}
                      onChange={(e) => setQuantity(p.id, e.target.value)}
                      inputMode="decimal"
                      className="h-9 w-20 text-center"
                      invalid={badPrecision || overStock || !!serverError}
                      aria-label={t('pos.quantity')}
                      data-testid={`cart-qty-${p.id}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Plus className="size-4" />}
                      onClick={() => step(line, 1)}
                      aria-label="+1"
                    />
                    <span className="w-7 text-xs text-slate-500">{p.unit_code}</span>
                  </div>
                  {badPrecision && (
                    <p className="mt-1 text-center text-xs text-red-600">
                      {t('pos.precision', { places: p.unit_decimal_places })}
                    </p>
                  )}
                </td>
                <td className="py-2 pr-2 pt-4 text-right tabular-nums">
                  {formatNumber(p.price, places)}
                </td>
                {canDiscount && (
                  <td className="py-2 pr-2">
                    <Input
                      value={line.discount}
                      onChange={(e) => setDiscount(p.id, e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      className="h-9 text-right"
                      aria-label={t('pos.discount')}
                      data-testid={`cart-discount-${p.id}`}
                    />
                  </td>
                )}
                <td
                  className={cn(
                    'py-2 pr-2 pt-4 text-right font-semibold tabular-nums',
                    total !== null && total < 0n && 'text-red-600',
                  )}
                >
                  {total === null ? '—' : formatNumber(minorToString(total, places), places)}
                </td>
                <td className="py-2 pt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => remove(p.id)}
                    aria-label={t('pos.remove')}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
