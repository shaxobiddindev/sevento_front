import { useTranslation } from 'react-i18next'

import { validateLines, type LineErrors, type LineValue } from '../lib/lines'

/** Qatorlarni tekshiradi va xatolarni o'zbekcha matnga aylantiradi (bo'sh — xato yo'q). */
export function useLineValidation() {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  return (lines: LineValue[]): LineErrors => {
    const result: LineErrors = {}
    for (const [index, problem] of Object.entries(validateLines(lines))) {
      const places = lines[Number(index)].product?.unit_decimal_places
      const text = (code?: string) =>
        code === 'required'
          ? tc('validation:required')
          : code === 'positive'
            ? tc('validation:positive')
            : code === 'duplicate'
              ? tc('errors:duplicate_product')
              : code === 'precision'
                ? t('doc.unitPrecision', { places })
                : undefined
      result[Number(index)] = { product: text(problem.product), quantity: text(problem.quantity) }
    }
    return result
  }
}
