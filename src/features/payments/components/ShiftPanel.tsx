import { DoorClosed, DoorOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import { errorMessage } from '@/shared/api/errors'
import type { CashShift } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/date'
import { formatNumber, parseDecimalInput, toDecimalInput } from '@/shared/lib/money'
import { Badge, Button, Card, Input, Modal, toast } from '@/shared/ui'

import { useCloseShift, useCurrentShift, useOpenShift } from '../api/payments.api'

/** Joriy smena: kim ochgan, ochilishdagi va hozirgi qoldiq; ochish / yopish (sanalgan naqd). */
export function ShiftPanel({ branchId }: { branchId: number }) {
  const { t } = useTranslation('payments')
  const canManage = useCapability('cashbox.manage')
  const current = useCurrentShift(branchId)
  const open = useOpenShift()
  const [closing, setClosing] = useState<CashShift | null>(null)
  const shift = current.data?.shift ?? null

  return (
    <Card data-testid="shift-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">{t('shift.title')}</h2>
          {shift ? (
            <Badge tone="success">{t('shift.status.open')}</Badge>
          ) : (
            <Badge tone="neutral">{t('shift.noShift')}</Badge>
          )}
        </div>
        {canManage &&
          (shift ? (
            <Button
              size="sm"
              variant="secondary"
              icon={<DoorClosed className="size-4" />}
              onClick={() => setClosing(shift)}
              data-testid="shift-close"
            >
              {t('shift.close')}
            </Button>
          ) : (
            <Button
              size="sm"
              icon={<DoorOpen className="size-4" />}
              loading={open.isPending}
              onClick={() =>
                open.mutate(
                  { branch: branchId },
                  {
                    onSuccess: () => toast.success(t('shift.opened')),
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
              data-testid="shift-open"
            >
              {t('shift.open')}
            </Button>
          ))}
      </div>
      {shift && (
        <div className="mt-3 text-sm">
          <p className="text-xs text-slate-500">
            {t('shift.openedBy', {
              name: shift.opened_by_name,
              date: formatDateTime(shift.opened_at),
            })}
          </p>
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-slate-500 uppercase">
              <tr>
                <th className="pb-1" />
                <th className="pb-1 text-right">{t('shift.opening')}</th>
                <th className="pb-1 text-right">{t('shift.current')}</th>
              </tr>
            </thead>
            <tbody>
              {shift.balances.map((b) => (
                <tr key={b.cashbox}>
                  <td className="py-0.5 font-medium">{b.currency_code}</td>
                  <td className="py-0.5 text-right text-slate-500 tabular-nums">
                    {formatNumber(b.opening_balance, b.currency_decimal_places)}
                  </td>
                  <td className="py-0.5 text-right font-semibold tabular-nums">
                    {formatNumber(b.current_balance, b.currency_decimal_places)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {closing && <CloseShiftModal shift={closing} onClose={() => setClosing(null)} />}
    </Card>
  )
}

function CloseShiftModal({ shift, onClose }: { shift: CashShift; onClose: () => void }) {
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const { currencies } = useActiveCurrencies()
  const close = useCloseShift()
  const [actual, setActual] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      shift.balances.map((b) => [b.currency_code, toDecimalInput(b.current_balance)]),
    ),
  )

  const submit = () =>
    close.mutate(
      {
        id: shift.id,
        body: {
          note: '',
          actual: shift.balances.map((b) => ({
            currency: currencies.find((c) => c.code === b.currency_code)!.id,
            amount: parseDecimalInput(actual[b.currency_code] || '0'),
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success(t('shift.closed'))
          onClose()
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )

  return (
    <Modal
      open
      onClose={onClose}
      title={t('shift.close')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button onClick={submit} loading={close.isPending} data-testid="shift-close-confirm">
            {t('shift.close')}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">{t('shift.closeHint')}</p>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500 uppercase">
          <tr>
            <th className="pb-2" />
            <th className="pb-2 text-right">{t('shift.expected')}</th>
            <th className="w-40 pb-2 text-right">{t('shift.actual')}</th>
            <th className="pb-2 text-right">{t('shift.difference')}</th>
          </tr>
        </thead>
        <tbody>
          {shift.balances.map((b) => {
            const dp = b.currency_decimal_places
            const diff =
              Number(parseDecimalInput(actual[b.currency_code] || '0')) - Number(b.current_balance)
            return (
              <tr key={b.cashbox}>
                <td className="py-1 font-medium">{b.currency_code}</td>
                <td className="py-1 text-right tabular-nums">
                  {formatNumber(b.current_balance, dp)}
                </td>
                <td className="py-1 pl-2">
                  <Input
                    value={actual[b.currency_code] ?? ''}
                    onChange={(e) =>
                      setActual((a) => ({ ...a, [b.currency_code]: e.target.value }))
                    }
                    inputMode="decimal"
                    className="text-right"
                    data-testid={`shift-actual-${b.currency_code}`}
                  />
                </td>
                <td
                  className={cn(
                    'py-1 text-right font-semibold tabular-nums',
                    diff < 0 ? 'text-red-700' : diff > 0 ? 'text-emerald-700' : 'text-slate-400',
                  )}
                >
                  {diff > 0 ? '+' : ''}
                  {formatNumber(diff, dp)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Modal>
  )
}
