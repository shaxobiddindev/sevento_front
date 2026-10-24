import { useTranslation } from 'react-i18next'

import type { StockCountStatus, TransferStatus } from '@/shared/api/types'
import { Badge } from '@/shared/ui'

const transferTones = {
  draft: 'warning',
  sent: 'info',
  received: 'success',
  cancelled: 'neutral',
} as const

export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const { t } = useTranslation('inventory')
  return <Badge tone={transferTones[status]}>{t(`transfers.status.${status}`)}</Badge>
}

const countTones = { draft: 'warning', completed: 'success', cancelled: 'neutral' } as const

export function CountStatusBadge({ status }: { status: StockCountStatus }) {
  const { t } = useTranslation('inventory')
  return <Badge tone={countTones[status]}>{t(`counts.status.${status}`)}</Badge>
}

const writeOffTones = { completed: 'success', cancelled: 'neutral' } as const

export function WriteOffStatusBadge({ status }: { status: 'completed' | 'cancelled' }) {
  const { t } = useTranslation('inventory')
  return <Badge tone={writeOffTones[status]}>{t(`writeOffs.status.${status}`)}</Badge>
}
