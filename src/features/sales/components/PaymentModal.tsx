import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ApiError } from '@/shared/api/errors'
import type { Currency, PaymentMethod } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { toIsoDate } from '@/shared/lib/date'
import { fitsPrecision, formatNumber, parseDecimalInput } from '@/shared/lib/money'
import { Button, Input, Modal, Select } from '@/shared/ui'

import {
  amountToCover,
  ceilToMinor,
  convertTo4,
  fromScaled,
  minorToString,
  paymentState,
} from '../lib/money'

export interface PaymentInput {
  method: number
  currency: number
  amount: string
}

export interface CreditOptions {
  customerName: string
  /** kredit limiti doirasida mavjud summa, savdo valyutasida 4 xona (null — noma'lum) */
  available4: bigint | null
}

interface Row {
  id: number
  methodId: number
  currency: string
  amount: string
}

interface Props {
  totalMinor: bigint
  saleCurrency: string
  places: number
  currencies: Currency[]
  decimals: Record<string, number>
  /** 1 birlik = N so'm (so'm — "1"); kurs yo'q valyuta bilan to'lab bo'lmaydi */
  rates: Record<string, string | undefined>
  methods: PaymentMethod[]
  loading: boolean
  error: ApiError | null
  /** mijoz tanlangan va `sales.credit` bor — qolgan summa nasiyaga */
  credit?: CreditOptions | null
  /** foydalanuvchi nasiyaga sota oladi (mijoz tanlanmagan bo'lsa — maslahat ko'rsatiladi) */
  canCredit?: boolean
  onClose: () => void
  onConfirm: (payments: PaymentInput[], extra: { dueDate: string | null }) => void
}

/** Ochilganda yangi kalit bilan yaratiladi (holat har safar boshidan). */
export function PaymentModal(props: Props) {
  const { totalMinor, saleCurrency, places, currencies, decimals, rates, methods } = props
  const { t } = useTranslation('sales')
  const cash = methods.find((m) => m.is_cash) ?? methods[0]
  const [rows, setRows] = useState<Row[]>(() => [
    {
      id: 1,
      methodId: cash?.id ?? 0,
      currency: saleCurrency,
      amount: minorToString(totalMinor, places),
    },
  ])

  const computed = useMemo(
    () =>
      rows.map((row) => {
        const same = row.currency === saleCurrency
        const rate = rates[row.currency]
        const value = parseDecimalInput(row.amount)
        const amountOk =
          value !== '' &&
          Number(value) > 0 &&
          fitsPrecision(row.amount, decimals[row.currency] ?? 2)
        const converted =
          rate && rates[saleCurrency]
            ? convertTo4(row.amount, rate, rates[saleCurrency]!, same)
            : null
        const method = methods.find((m) => m.id === row.methodId)
        return { row, converted, valid: amountOk && converted !== null, isCash: !!method?.is_cash }
      }),
    [rows, saleCurrency, rates, decimals, methods],
  )
  const state = paymentState(
    totalMinor,
    places,
    computed.map((c) => c.converted ?? 0n),
    computed.filter((c) => c.isCash).reduce((a, c) => a + (c.converted ?? 0n), 0n),
  )
  const allValid = computed.every((c) => c.valid)
  const [dueDate, setDueDate] = useState('')
  const credit = props.credit ?? null
  const onCredit = state.remaining4 > 0n && credit !== null
  const overLimit = onCredit && credit.available4 !== null && state.remaining4 > credit.available4
  const canConfirm =
    allValid &&
    (state.remaining4 === 0n || (onCredit && !overLimit)) &&
    !state.changeNotCash &&
    !props.loading

  const update = (id: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const remainingWithout = (id: number) => {
    const others = computed.filter((c) => c.row.id !== id)
    return paymentState(
      totalMinor,
      places,
      others.map((c) => c.converted ?? 0n),
      0n,
    ).remaining4
  }

  const fillRest = (row: Row) => {
    const rate = rates[row.currency]
    if (!rate || !rates[saleCurrency]) return
    update(row.id, {
      amount: amountToCover(
        remainingWithout(row.id),
        decimals[row.currency] ?? 2,
        rate,
        rates[saleCurrency]!,
        row.currency === saleCurrency,
      ),
    })
  }

  const confirm = () => {
    if (!canConfirm) return
    props.onConfirm(
      rows.map((r) => ({
        method: r.methodId,
        currency: currencies.find((c) => c.code === r.currency)!.id,
        amount: parseDecimalInput(r.amount),
      })),
      { dueDate: onCredit && dueDate ? dueDate : null },
    )
  }

  const money = (minor: bigint) => formatNumber(minorToString(minor, places), places)

  return (
    <Modal
      open
      onClose={props.onClose}
      title={t('payment.title')}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={props.onClose}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            onClick={confirm}
            disabled={!canConfirm}
            loading={props.loading}
            data-testid="pay-confirm"
          >
            {t('payment.confirm')}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-baseline justify-between rounded-lg bg-slate-50 px-4 py-3">
        <span className="text-sm text-slate-600">{t('payment.total')}</span>
        <span className="text-2xl font-bold tabular-nums" data-testid="pay-total">
          {money(totalMinor)} {saleCurrency}
        </span>
      </div>

      <div className="space-y-2">
        {computed.map(({ row, converted, valid }) => {
          const rateMissing = !rates[row.currency]
          return (
            <div
              key={row.id}
              className="grid items-start gap-2 sm:grid-cols-[1fr_6rem_1fr_auto_auto]"
            >
              <Select
                value={row.methodId}
                onChange={(e) => update(row.id, { methodId: Number(e.target.value) })}
                aria-label={t('payment.method')}
                data-testid={`pay-method-${row.id}`}
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <Select
                value={row.currency}
                onChange={(e) => update(row.id, { currency: e.target.value, amount: '' })}
                aria-label={t('payment.currency')}
                data-testid={`pay-currency-${row.id}`}
              >
                {currencies.map((c) => (
                  <option key={c.id} value={c.code} disabled={!rates[c.code]}>
                    {c.code}
                  </option>
                ))}
              </Select>
              <div>
                <Input
                  value={row.amount}
                  onChange={(e) => update(row.id, { amount: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      confirm()
                    }
                  }}
                  inputMode="decimal"
                  className="text-right text-base font-semibold"
                  invalid={row.amount !== '' && !valid}
                  aria-label={t('payment.amount')}
                  autoFocus={row.id === rows[rows.length - 1]?.id}
                  data-testid={`pay-amount-${row.id}`}
                />
                {rateMissing ? (
                  <p className="mt-1 text-xs text-red-600">
                    {t('payment.noRate', { currency: row.currency })}
                  </p>
                ) : row.currency !== saleCurrency && converted !== null ? (
                  <p className="mt-1 text-right text-xs text-slate-500">
                    {t('payment.inSale', {
                      amount: `${formatNumber(fromScaled(converted, 4), places)} ${saleCurrency}`,
                    })}
                  </p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                onClick={() => fillRest(row)}
                data-testid={`pay-fill-${row.id}`}
              >
                {t('payment.fillRest')}
              </Button>
              <Button
                variant="ghost"
                icon={<Trash2 className="size-4" />}
                disabled={rows.length === 1 && !credit}
                onClick={() => setRows((list) => list.filter((r) => r.id !== row.id))}
                data-testid={`pay-remove-${row.id}`}
                aria-label={t('pos.remove')}
              />
            </div>
          )
        })}
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="mt-2"
        icon={<Plus className="size-4" />}
        onClick={() =>
          setRows((list) => [
            ...list,
            {
              id: Math.max(0, ...list.map((r) => r.id)) + 1,
              methodId: methods.find((m) => !m.is_cash)?.id ?? cash?.id ?? 0,
              currency: saleCurrency,
              amount: '',
            },
          ])
        }
        data-testid="pay-add"
      >
        {t('payment.addRow')}
      </Button>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-200 pt-3 text-sm">
        <dt className="text-slate-600">{t('payment.paid')}</dt>
        <dd className="text-right tabular-nums">
          {formatNumber(fromScaled(state.paid4, 4), places)} {saleCurrency}
        </dd>
        {onCredit ? (
          <>
            <dt className="font-semibold text-amber-700">{t('payment.credit')}</dt>
            <dd
              className="text-right font-semibold text-amber-700 tabular-nums"
              data-testid="pay-credit"
            >
              {money(ceilToMinor(state.remaining4, places))} {saleCurrency}
            </dd>
          </>
        ) : state.remaining4 > 0n ? (
          <>
            <dt className="font-semibold text-red-700">{t('payment.remaining')}</dt>
            <dd
              className="text-right font-semibold text-red-700 tabular-nums"
              data-testid="pay-remaining"
            >
              {money(ceilToMinor(state.remaining4, places))} {saleCurrency}
            </dd>
          </>
        ) : (
          <>
            <dt className="text-lg font-semibold">{t('payment.change')}</dt>
            <dd
              className={cn(
                'text-right text-lg font-bold tabular-nums',
                state.change > 0n ? 'text-emerald-700' : 'text-slate-500',
              )}
              data-testid="pay-change"
            >
              {money(state.change)} {saleCurrency}
            </dd>
          </>
        )}
      </dl>
      {onCredit && (
        <div className="mt-3 grid items-end gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm sm:grid-cols-[1fr_11rem]">
          <p className="text-amber-800">
            {t('payment.creditHint', { customer: credit.customerName })}
            {overLimit && credit.available4 !== null && (
              <span className="mt-1 block font-medium text-red-700">
                {t('payment.overLimit', {
                  amount: formatNumber(fromScaled(credit.available4, 4), places),
                  base: saleCurrency,
                })}
              </span>
            )}
          </p>
          <label className="text-xs text-slate-600">
            {t('payment.dueDate')}
            <Input
              type="date"
              min={toIsoDate()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              data-testid="pay-due-date"
            />
          </label>
        </div>
      )}
      {state.remaining4 > 0n && !credit && props.canCredit && (
        <p className="mt-2 text-xs text-slate-500">{t('payment.noCustomer')}</p>
      )}
      {state.changeNotCash && (
        <p className="mt-2 text-sm text-red-600">{t('payment.changeNotCash')}</p>
      )}
      {props.error && (
        <div role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">{props.error.message}</p>
          {props.error.details.map((d, i) => (
            <p key={i}>{d.message}</p>
          ))}
        </div>
      )}
    </Modal>
  )
}
