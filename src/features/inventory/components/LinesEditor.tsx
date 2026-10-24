import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ProductPicker } from '@/features/catalog'
import { Button, Input } from '@/shared/ui'

import { newLine, type LineErrors, type LineValue } from '../lib/lines'

/** Tovar + miqdor qatorlari (ko'chirish, hisobdan chiqarish). Boshqariladigan komponent. */
export function LinesEditor({
  value,
  onChange,
  errors,
  editable,
}: {
  value: LineValue[]
  onChange: (lines: LineValue[]) => void
  errors?: LineErrors
  editable: boolean
}) {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const update = (index: number, patch: Partial<LineValue>) =>
    onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)))

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="w-8 pb-2">#</th>
              <th className="pb-2">{t('doc.product')}</th>
              <th className="w-44 pb-2">{t('doc.quantity')}</th>
              <th className="w-10 pb-2" />
            </tr>
          </thead>
          <tbody>
            {value.map((line, index) => {
              const err = errors?.[index]
              return (
                <tr key={line.key} className="align-top" data-testid="doc-line">
                  <td className="py-1.5 pr-2 pt-3 text-slate-400">{index + 1}</td>
                  <td className="py-1.5 pr-2">
                    <ProductPicker
                      value={line.product}
                      onChange={(product) => update(index, { product })}
                      invalid={!!err?.product}
                      disabled={!editable}
                    />
                    {err?.product && <p className="mt-1 text-xs text-red-600">{err.product}</p>}
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex items-center gap-1">
                      <Input
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) => update(index, { quantity: e.target.value })}
                        invalid={!!err?.quantity}
                        disabled={!editable}
                        aria-label={t('doc.quantity')}
                      />
                      <span className="w-8 text-xs text-slate-500">{line.product?.unit_code}</span>
                    </div>
                    {err?.quantity && <p className="mt-1 text-xs text-red-600">{err.quantity}</p>}
                  </td>
                  <td className="py-1.5">
                    {editable && value.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="size-4" />}
                        onClick={() => onChange(value.filter((_, i) => i !== index))}
                        aria-label={tc('actions.delete')}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editable && (
        <Button
          size="sm"
          variant="secondary"
          className="mt-2"
          icon={<Plus className="size-4" />}
          onClick={() => onChange([...value, newLine()])}
        >
          {t('doc.addLine')}
        </Button>
      )}
    </div>
  )
}
