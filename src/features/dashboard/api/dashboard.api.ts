import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Dashboard } from '@/shared/api/types'

export type DashboardPeriod = 'today' | '7d' | '30d' | 'month'

export interface DashboardParams {
  period: DashboardPeriod
  branch?: number
}

/** Savdo, to'lov, qaytarishda `dashboard.updated` → ['dashboard'] invalidate (jonli). */
export function useDashboard(params: DashboardParams) {
  return useQuery({
    queryKey: queryKeys.dashboard.data(params),
    queryFn: () =>
      api.get<Dashboard>('/reports/dashboard/', { period: params.period, branch: params.branch }),
    placeholderData: (prev) => prev,
    meta: { pollWhenOffline: true },
  })
}
