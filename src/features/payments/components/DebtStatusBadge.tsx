import { useTranslation } from 'react-i18next'

import type { DebtStatus } from '@/shared/api/types'
import { Badge } from '@/shared/ui'

export function DebtStatusBadge({ status, overdue }: { status: DebtStatus; overdue?: boolean }) {
  const { t } = useTranslation('payments')
  if (status === 'open' && overdue) return <Badge tone="danger">{t('customers.overdue')}</Badge>
  const tone = status === 'paid' ? 'success' : status === 'cancelled' ? 'neutral' : 'warning'
  return <Badge tone={tone}>{t(`debts.statuses.${status}`)}</Badge>
}
