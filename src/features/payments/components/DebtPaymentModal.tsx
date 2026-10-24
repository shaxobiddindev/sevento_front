import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import { newIdempotencyKey } from '@/shared/api/client'
import { toApiError, type ApiError } from '@/shared/api/errors'
import type { CustomerDetail } from '@/shared/api/types'
import { fitsPrecision, formatNumber, parseDecimalInput, toDecimalInput } from '@/shared/lib/money'
import { Button, FormField, Input, Modal, Select, toast } from '@/shared/ui'

import { paymentsApi, usePaymentMethods, usePayDebt } from '../api/payments.api'
import { formatBalances } from '../lib/format'

interface Props {
  customer: CustomerDetail
  onClose: () => void
}

/** Qarz to'lovi: valyuta va to'lov turi tanlanadi; "Hammasini" — server hisoblagan to'liq summa. */
export function DebtPaymentModal({ customer, onClose }: Props) {
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const currentBranch = useAuthStore((s) => s.currentBranchId)
  const { currencies, decimals } = useActiveCurrencies()
  const methods = (usePaymentMethods().data ?? []).filter((m) => m.is_active)
  const pay = usePayDebt()
  const [key] = useState(newIdempotencyKey)
  const firstCurrency = customer.balances[0]?.currency ?? currencies[0]?.code ?? ''
  const [branch, setBranch] = useState<number | ''>(currentBranch ?? user?.branches[0]?.id ?? '')
  const [methodId, setMethodId] = useState<number | ''>(methods.find((m) => m.is_cash)?.id ?? '')
  const [currency, setCurrency] = useState(firstCurrency)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const method =
    methodId === ''
      ? (methods.find((m) => m.is_cash) ?? methods[0])
      : methods.find((m) => m.id === methodId)
  const places = decimals[currency] ?? 2
  const valid =
    branch !== '' &&
    !!method &&
    Number(parseDecimalInput(amount)) > 0 &&
    fitsPrecision(amount, places)

  const fillAll = async () => {
    try {
      const payoff = await paymentsApi.payoff(customer.id, currency)
      setAmount(toDecimalInput(payoff.amount))
    } catch (e) {
      setError(toApiError(e))
    }
  }

  const submit = () => {
    if (!valid || !method) return
    setError(null)
    pay.mutate(
      {
        customerId: customer.id,
        idempotencyKey: key,
        body: {
          branch: Number(branch),
          method: method.id,
          currency: currencies.find((c) => c.code === currency)!.id,
          amount: parseDecimalInput(amount),
          debt_ids: [],
          note: '',
        },
      },
      {
        onSuccess: (payment) => {
          toast.success(
            t('pay.received', {
              amount: `${formatNumber(payment.amount, places)} ${payment.currency_code}`,
            }),
          )
          onClose()
        },
        onError: (e) => setError(toApiError(e)),
      },
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t('pay.title')} — ${customer.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={!valid}
            loading={pay.isPending}
            data-testid="debt-pay-confirm"
          >
            {t('pay.confirm')}
          </Button>
        </>
      }
    >
      <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-sm">
        {t('credit.balances')}:{' '}
        <span className="font-semibold">{formatBalances(customer.balances, decimals)}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(user?.branches.length ?? 0) > 1 && (
          <FormField label={t('pay.branch')}>
            <Select value={branch} onChange={(e) => setBranch(Number(e.target.value))}>
              {user?.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label={t('pay.method')}>
          <Select value={method?.id ?? ''} onChange={(e) => setMethodId(Number(e.target.value))}>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('pay.currency')}>
          <Select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value)
              setAmount('')
            }}
            data-testid="debt-pay-currency"
          >
            {currencies.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('pay.amount')} hint={t('pay.hint')}>
          <div className="flex gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              inputMode="decimal"
              className="text-right font-semibold"
              autoFocus
              data-testid="debt-pay-amount"
            />
            <Button variant="secondary" onClick={() => void fillAll()} data-testid="debt-pay-full">
              {t('pay.full')}
            </Button>
          </div>
        </FormField>
      </div>
      {error && (
        <div role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">{error.message}</p>
          {error.details.map((d, i) => (
            <p key={i}>{d.message}</p>
          ))}
        </div>
      )}
    </Modal>
  )
}
