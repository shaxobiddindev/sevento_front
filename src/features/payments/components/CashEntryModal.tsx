import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useActiveCurrencies } from '@/features/currency'
import { errorMessage } from '@/shared/api/errors'
import { fitsPrecision, parseDecimalInput } from '@/shared/lib/money'
import { Button, FormField, Input, Modal, Select, toast } from '@/shared/ui'

import { useCashCategories, useCashEntry } from '../api/payments.api'

/** Qo'lda kassa yozuvi: kiritish, inkassatsiya, xarajat (faqat `cashbox.manage`). */
export function CashEntryModal({ branchId, onClose }: { branchId: number; onClose: () => void }) {
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const { currencies, decimals } = useActiveCurrencies()
  const categories = (useCashCategories().data ?? []).filter((c) => c.is_manual)
  const entry = useCashEntry()
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [category, setCategory] = useState('')
  const [currency, setCurrency] = useState(currencies[0]?.code ?? '')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const options = categories.filter((c) => c.direction === direction || c.direction === 'both')
  const selected = options.find((c) => c.code === category) ?? options[0]
  const valid =
    !!selected &&
    Number(parseDecimalInput(amount)) > 0 &&
    fitsPrecision(amount, decimals[currency] ?? 2) &&
    note.trim().length > 0

  const submit = () =>
    selected &&
    entry.mutate(
      {
        branch: branchId,
        currency: currencies.find((c) => c.code === currency)!.id,
        direction,
        category: selected.code,
        amount: parseDecimalInput(amount),
        note: note.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t('entry.saved'))
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <Modal
      open
      onClose={onClose}
      title={t('entry.title')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button
            onClick={submit}
            disabled={!valid}
            loading={entry.isPending}
            data-testid="entry-save"
          >
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('entry.direction')}>
            <Select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as 'in' | 'out')
                setCategory('')
              }}
              data-testid="entry-direction"
            >
              <option value="in">{t('cash.in')}</option>
              <option value="out">{t('cash.out')}</option>
            </Select>
          </FormField>
          <FormField label={t('entry.category')}>
            <Select
              value={selected?.code ?? ''}
              onChange={(e) => setCategory(e.target.value)}
              data-testid="entry-category"
            >
              {options.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <FormField label={t('entry.currency')}>
            <Select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              data-testid="entry-currency"
            >
              {currencies.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('entry.amount')}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="text-right"
              data-testid="entry-amount"
            />
          </FormField>
        </div>
        <FormField label={t('entry.note')} required>
          <Input value={note} onChange={(e) => setNote(e.target.value)} data-testid="entry-note" />
        </FormField>
      </div>
    </Modal>
  )
}
