import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { SystemSetting } from '@/shared/api/types'

export const systemApi = {
  list: () => api.get<SystemSetting[]>('/settings/'),
  update: (key: string, value: unknown) => api.put<SystemSetting>(`/settings/${key}/`, { value }),
  reset: (key: string) => api.delete<SystemSetting>(`/settings/${key}/`),
}

export function useSystemSettings() {
  return useQuery({ queryKey: queryKeys.settings.all, queryFn: systemApi.list })
}

function useReplaceSetting() {
  const qc = useQueryClient()
  return (updated: SystemSetting) =>
    qc.setQueryData<SystemSetting[]>(queryKeys.settings.all, (items) =>
      items?.map((item) => (item.key === updated.key ? updated : item)),
    )
}

export function useUpdateSystemSetting() {
  const replace = useReplaceSetting()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => systemApi.update(key, value),
    onSuccess: replace,
  })
}

export function useResetSystemSetting() {
  const replace = useReplaceSetting()
  return useMutation({ mutationFn: (key: string) => systemApi.reset(key), onSuccess: replace })
}
