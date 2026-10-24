import { CheckCircle2, ExternalLink, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { SaleDetail } from '@/shared/api/types'
import { formatDate } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { Button, Modal } from '@/shared/ui'

import { printReceipt } from '../lib/receipt'

export function SaleSuccessModal({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const { t } = useTranslation('sales')
  const places = sale.currency_decimal_places
  const change = Number(sale.change_amount)
  return (
    <Modal
      open
      onClose={onClose}
      title={t('success.title')}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            icon={<ExternalLink className="size-4" />}
            onClick={() => void printReceipt(sale.id, 'open')}
          >
            {t('success.open')}
          </Button>
          <Button
            variant="secondary"
            icon={<Printer className="size-4" />}
            onClick={() => void printReceipt(sale.id)}
            data-testid="success-print"
          >
            {t('success.print')}
          </Button>
          <Button onClick={onClose} autoFocus data-testid="success-new">
            {t('success.newSale')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-2 py-2 text-center" data-testid="sale-success">
        <CheckCircle2 className="size-12 text-emerald-600" />
        <p className="text-sm text-slate-500">
          {t('success.number')} <span className="font-semibold text-slate-800">{sale.number}</span>
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {formatNumber(sale.total, places)} {sale.currency_code}
        </p>
        {Number(sale.debt_amount) > 0 && (
          <div
            className="rounded-md bg-amber-50 px-4 py-2 text-amber-900"
            data-testid="success-debt"
          >
            <p className="text-lg font-semibold">
              {t('success.debt', {
                amount: formatNumber(sale.debt_amount, places),
                currency: sale.currency_code,
              })}
            </p>
            <p className="text-sm">
              {sale.customer_name} · {t('success.dueDate', { date: formatDate(sale.due_date) })}
            </p>
          </div>
        )}
        {change > 0 && (
          <p
            className="rounded-md bg-emerald-50 px-4 py-2 text-lg font-semibold text-emerald-800"
            data-testid="success-change"
          >
            {t('success.change')}: {formatNumber(sale.change_amount, places)} {sale.currency_code}
          </p>
        )}
      </div>
    </Modal>
  )
}
