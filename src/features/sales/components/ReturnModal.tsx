import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { usePaymentMethods } from '@/features/payments'
import { isApiError } from '@/shared/api/errors'
import type { SaleDetail } from '@/shared/api/types'
import { fromScaled, minorToString, toScaled } from '@/shared/lib/decimal'
import { fitsPrecision, formatNumber, parseDecimalInput } from '@/shared/lib/money'
import { Button, FormField, Input, Modal, Select, toast } from '@/shared/ui'

import { useCreateReturn } from '../api/sales.api'
import { returnAmountMinor, splitRefund } from '../lib/returns'

const SCALE = 3

/** Savdodan tovar qaytarish: qator bo'yicha miqdor, sabab, pul qaytarish turi (qarzdan ortgani). */
export function ReturnModal({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const { t } = useTranslation('sales')
  const methods = usePaymentMethods()
  const create = useCreateReturn()
  const places = sale.currency_decimal_places
  const [qty, setQty] = useState<Record<number, string>>({})
  const [reason, setReason] = useState('')
  const [method, setMethod] = useState('')
  const [serverErrors, setServerErrors] = useState<Record<number, string>>({})

  const rows = sale.items.map((item, index) => {
    const available =
      (toScaled(item.quantity, SCALE) ?? 0n) - (toScaled(item.returned_quantity, SCALE) ?? 0n)
    const text = (qty[item.id] ?? '').trim()
    let error: string | undefined = serverErrors[index]
    let amount: bigint | null = 0n
    if (text) {
      const q = toScaled(text, SCALE)
      if (q === null || q <= 0n) error = t('validation:positive')
      else if (q > available) error = t('errors:exceeds_sold')
      else if (!fitsPrecision(text, item.unit_decimal_places))
        error = t('inventory:doc.unitPrecision', { places: item.unit_decimal_places })
      amount = error
        ? null
        : returnAmountMinor(item.line_total, item.quantity, item.returned_quantity, text, places)
    }
    return { item, available, text, error, amount }
  })
  const chosen = rows.filter((r) => r.text && !r.error)
  const invalid = rows.some((r) => r.error)
  const totalMinor = chosen.reduce((acc, r) => acc + (r.amount ?? 0n), 0n)
  const debtOpen = sale.debt && sale.debt.status === 'open' ? sale.debt.remaining : null
  const { fromDebt, refund } = splitRefund(totalMinor, debtOpen, places)
  const money = (v: bigint) => formatNumber(minorToString(v, places), places)
  const activeMethods = (methods.data ?? []).filter((m) => m.is_active !== false)

  const onSubmit = () => {
    if (!chosen.length || invalid || !reason.trim()) return
    create.mutate(
      {
        sale: sale.id,
        items: chosen.map((r) => ({ sale_item: r.item.id, quantity: parseDecimalInput(r.text) })),
        reason: reason.trim(),
        refund_method: method ? Number(method) : null,
      },
      {
        onSuccess: (data) => {
          toast.success(
            t('returns.done', { number: data.number }),
            t('returns.doneText', {
              debt: formatNumber(data.debt_reduction, places),
              refund: formatNumber(data.refund_amount, places),
              currency: data.currency_code,
            }),
          )
          onClose()
        },
        onError: (error) => {
          if (isApiError(error)) {
            const byLine: Record<number, string> = {}
            for (const d of error.details) {
              const m = /^items\.(\d+)\.quantity$/.exec(d.field ?? '')
              if (m) {
                // server qatori — yuborilgan (tanlangan) qatorlar tartibida
                const row = chosen[Number(m[1])]
                if (row) byLine[sale.items.indexOf(row.item)] = d.message
              }
            }
            setServerErrors(byLine)
          }
          toast.error(error.message)
        },
      },
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('returns.modalTitle', { number: sale.number })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common:actions.close')}
          </Button>
          <Button
            variant="danger"
            loading={create.isPending}
            disabled={!chosen.length || invalid || !reason.trim()}
            onClick={onSubmit}
            data-testid="return-submit"
          >
            {t('returns.submit')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">{t('returns.hint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="pb-2">{t('returns.product')}</th>
              <th className="pb-2 text-right">{t('returns.sold')}</th>
              <th className="pb-2 text-right">{t('returns.available')}</th>
              <th className="w-40 pb-2 pl-2">{t('returns.quantity')}</th>
              <th className="pb-2 text-right">{t('returns.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, available, error, amount }) => (
              <tr key={item.id} className="border-t border-slate-100 align-top">
                <td className="py-2">{item.product_name}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(item.quantity, item.unit_decimal_places)} {item.unit_code}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatNumber(fromScaled(available, SCALE), item.unit_decimal_places)}
                </td>
                <td className="py-1.5 pl-2">
                  {available > 0n ? (
                    <div className="flex gap-1">
                      <Input
                        inputMode="decimal"
                        value={qty[item.id] ?? ''}
                        onChange={(e) => {
                          setQty({ ...qty, [item.id]: e.target.value })
                          setServerErrors({})
                        }}
                        invalid={!!error}
                        aria-label={`${t('returns.quantity')}: ${item.product_name}`}
                        data-testid="return-qty"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setQty({
                            ...qty,
                            [item.id]: fromScaled(available, SCALE).replace(/\.?0+$/, ''),
                          })
                          setServerErrors({})
                        }}
                      >
                        {t('returns.all')}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                  {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                </td>
                <td className="py-2 text-right tabular-nums">{amount ? money(amount) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label={t('returns.reason')} required>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('returns.reasonPlaceholder')}
            data-testid="return-reason"
          />
        </FormField>
        {refund > 0n && (
          <FormField label={t('returns.refundMethod')}>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">{activeMethods.find((m) => m.is_cash)?.name ?? '—'}</option>
              {activeMethods
                .filter((m) => !m.is_cash)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </FormField>
        )}
      </div>

      <dl
        className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-y-1 text-sm"
        data-testid="return-summary"
      >
        <dt className="font-semibold">{t('returns.total')}</dt>
        <dd className="text-right font-bold tabular-nums">
          {money(totalMinor)} {sale.currency_code}
        </dd>
        {fromDebt > 0n && (
          <>
            <dt className="text-slate-600">{t('returns.debtReduction')}</dt>
            <dd className="text-right tabular-nums">{money(fromDebt)}</dd>
          </>
        )}
        <dt className="text-slate-600">{t('returns.refund')}</dt>
        <dd className="text-right tabular-nums">{money(refund)}</dd>
      </dl>
      <p className="mt-1 text-right text-xs text-slate-400">{t('returns.estimateNote')}</p>
    </Modal>
  )
}
