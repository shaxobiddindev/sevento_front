import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { StockLevel } from '@/shared/api/types'
import { formatNumber, parseDecimalInput, toDecimalInput } from '@/shared/lib/money'
import { Button, FormField, Input, Modal, toast } from '@/shared/ui'

import { useSetMinQuantity } from '../api/inventory.api'

export function MinQuantityModal({
  level,
  onClose,
}: {
  level: StockLevel | null
  onClose: () => void
}) {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const mutation = useSetMinQuantity()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [prevId, setPrevId] = useState<number | null>(null)
  if (level && level.id !== prevId) {
    setPrevId(level.id)
    setValue(toDecimalInput(level.min_quantity))
    setError(null)
  }
  if (!level) return null

  const submit = () => {
    const text = parseDecimalInput(value)
    if (text !== '' && !(Number(text) >= 0)) {
      setError(tc('validation:positive'))
      return
    }
    mutation.mutate(
      { id: level.id, minQuantity: text === '' ? null : text },
      {
        onSuccess: () => {
          toast.success(t('min.saved'))
          onClose()
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('min.title')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {t('min.subtitle', { product: level.product_name, branch: level.branch_name })}
      </p>
      <FormField
        label={t('min.value')}
        hint={t('min.hint', {
          current: formatNumber(level.effective_min, level.unit_decimal_places),
        })}
        error={error ?? undefined}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </FormField>
    </Modal>
  )
}
