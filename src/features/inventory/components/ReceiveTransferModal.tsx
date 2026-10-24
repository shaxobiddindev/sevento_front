import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { isApiError } from '@/shared/api/errors'
import type { TransferDetail } from '@/shared/api/types'
import { fromScaled, toScaled } from '@/shared/lib/decimal'
import { fitsPrecision, parseDecimalInput } from '@/shared/lib/money'
import { Button, FormField, Input, Modal, Textarea, toast } from '@/shared/ui'

import { useReceiveTransfer } from '../api/documents.api'
import { formatQty } from '../lib/lines'

const SCALE = 3 // miqdor maydoni 3 xona

/** Kelgan miqdor (default — jo'natilgani). Kam kelgan qism serverda avtomatik hisobdan chiqariladi. */
export function ReceiveTransferModal({
  transfer,
  onClose,
}: {
  transfer: TransferDetail
  onClose: () => void
}) {
  const { t } = useTranslation('inventory')
  const receive = useReceiveTransfer()
  const initial = () =>
    Object.fromEntries(
      transfer.items.map((i) => [i.id, formatQty(i.quantity, i.unit_decimal_places)]),
    )
  const [received, setReceived] = useState<Record<number, string>>(initial)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<number, string>>({})

  const rows = transfer.items.map((item) => {
    const sent = toScaled(item.quantity, SCALE) ?? 0n
    const got = toScaled(received[item.id] ?? '', SCALE)
    let error: string | undefined
    if (got === null || got < 0n || got > sent) {
      error = t('errors:received_out_of_range')
    } else if (!fitsPrecision(received[item.id], item.unit_decimal_places)) {
      error = t('doc.unitPrecision', { places: item.unit_decimal_places })
    }
    const shortage = got !== null && got >= 0n && got <= sent ? sent - got : null
    return { item, error: errors[item.id] ?? error, shortage }
  })
  const invalid = rows.some((r) => r.error)
  const shortLines = rows.filter((r) => r.shortage !== null && r.shortage > 0n).length

  const onSubmit = () => {
    if (invalid) return
    receive.mutate(
      {
        id: transfer.id,
        body: {
          items: transfer.items.map((i) => ({
            id: i.id,
            quantity_received: parseDecimalInput(received[i.id]),
          })),
          note,
        },
      },
      {
        onSuccess: (data) => {
          if (data.has_discrepancy) {
            toast.warning(t('transfers.receivedWithShortage', { count: shortLines }))
          } else {
            toast.success(t('transfers.receivedToast'))
          }
          onClose()
        },
        onError: (error) => {
          if (isApiError(error) && error.details.length) {
            const byLine: Record<number, string> = {}
            for (const d of error.details) {
              const m = /^items\.(\d+)\.quantity_received$/.exec(d.field ?? '')
              if (m) byLine[transfer.items[Number(m[1])]?.id] = d.message
            }
            setErrors(byLine)
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
      title={`${t('transfers.receiveTitle')} — ${transfer.number}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('doc.close')}
          </Button>
          <Button
            loading={receive.isPending}
            disabled={invalid}
            onClick={onSubmit}
            data-testid="receive-confirm"
          >
            {t('transfers.receive')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">{t('transfers.receiveHint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="pb-2">{t('doc.product')}</th>
              <th className="pb-2 text-right">{t('transfers.sentQty')}</th>
              <th className="w-40 pb-2 pl-4">{t('transfers.receivedQty')}</th>
              <th className="pb-2 text-right">{t('transfers.shortage')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, error, shortage }) => (
              <tr key={item.id} className="border-t border-slate-100 align-top">
                <td className="py-2">{item.product_name}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatQty(item.quantity, item.unit_decimal_places)} {item.unit_code}
                </td>
                <td className="py-1.5 pl-4">
                  <Input
                    inputMode="decimal"
                    value={received[item.id] ?? ''}
                    onChange={(e) => {
                      setReceived({ ...received, [item.id]: e.target.value })
                      setErrors({})
                    }}
                    invalid={!!error}
                    aria-label={`${t('transfers.receivedQty')}: ${item.product_name}`}
                    data-testid="receive-qty"
                  />
                  {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
                </td>
                <td
                  className={`py-2 text-right tabular-nums ${shortage && shortage > 0n ? 'font-semibold text-red-700' : 'text-slate-400'}`}
                >
                  {shortage && shortage > 0n
                    ? formatQty(fromScaled(shortage, SCALE), item.unit_decimal_places)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <FormField label={t('transfers.receiveNote')} className="min-w-60 flex-1">
          <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setReceived(initial())
            setErrors({})
          }}
        >
          {t('transfers.receiveAll')}
        </Button>
      </div>
    </Modal>
  )
}
