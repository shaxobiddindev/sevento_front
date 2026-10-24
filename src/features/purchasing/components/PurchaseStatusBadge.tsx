import { useTranslation } from 'react-i18next'

import type { PurchaseStatus } from '@/shared/api/types'
import { Badge } from '@/shared/ui'

const tones = { draft: 'warning', received: 'success', cancelled: 'neutral' } as const

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const { t } = useTranslation('purchasing')
  return <Badge tone={tones[status]}>{t(`status.${status}`)}</Badge>
}
