import { useTranslation } from 'react-i18next'

import type { SaleList, SaleStatus } from '@/shared/api/types'
import { Badge } from '@/shared/ui'

export function SaleStatusBadge({
  status,
  returnState = 'none',
}: {
  status: SaleStatus
  returnState?: SaleList['return_state']
}) {
  const { t } = useTranslation('sales')
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={status === 'completed' ? 'success' : 'danger'}>{t(`status.${status}`)}</Badge>
      {status === 'completed' && returnState !== 'none' && (
        <Badge tone="warning">{t(`returnState.${returnState}`)}</Badge>
      )}
    </span>
  )
}
