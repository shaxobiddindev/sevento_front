import { useQuery } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { AuditLog, ListParams, Paginated } from '@/shared/api/types'

export const auditApi = {
  list: (params: ListParams) => api.get<Paginated<AuditLog>>('/audit/', params),
}

export function useAuditLogs(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => auditApi.list(params),
    placeholderData: (prev) => prev,
  })
}
