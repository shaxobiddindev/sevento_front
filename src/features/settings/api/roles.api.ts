import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Paginated, Role, RolePatchRequest, RoleRequest } from '@/shared/api/types'

export const rolesApi = {
  list: () => api.get<Paginated<Role>>('/roles/', { page_size: 100 }),
  get: (id: number | string) => api.get<Role>(`/roles/${id}/`),
  create: (body: RoleRequest) => api.post<Role>('/roles/', body),
  update: (id: number | string, body: RolePatchRequest) => api.patch<Role>(`/roles/${id}/`, body),
  remove: (id: number | string) => api.delete(`/roles/${id}/`),
}

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: rolesApi.list,
    select: (data) => data.results,
  })
}

export function useRole(id: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.roles.detail(id ?? ''),
    queryFn: () => rolesApi.get(id!),
    enabled: id !== undefined,
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}

export function useUpdateRole(id: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RolePatchRequest) => rolesApi.update(id, body),
    onSuccess: (role) => {
      qc.setQueryData(queryKeys.roles.detail(id), role)
      void qc.invalidateQueries({ queryKey: queryKeys.roles.all })
    },
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number | string) => rolesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles.all }),
  })
}
