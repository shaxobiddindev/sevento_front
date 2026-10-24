import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type {
  ListParams,
  Paginated,
  SetPasswordRequest,
  User,
  UserPatchRequest,
  UserWriteRequest,
} from '@/shared/api/types'

export const usersApi = {
  list: (params: ListParams) => api.get<Paginated<User>>('/users/', params),
  get: (id: number | string) => api.get<User>(`/users/${id}/`),
  create: (body: UserWriteRequest) => api.post<User>('/users/', body),
  update: (id: number | string, body: UserPatchRequest) => api.patch<User>(`/users/${id}/`, body),
  setPassword: (id: number | string, body: SetPasswordRequest) =>
    api.post<void>(`/users/${id}/set-password/`, body),
}

export function useUsers(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => usersApi.list(params),
    placeholderData: (prev) => prev,
  })
}

export function useUser(id: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(id ?? ''),
    queryFn: () => usersApi.get(id!),
    enabled: id !== undefined,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users.all }),
  })
}

export function useUpdateUser(id: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UserPatchRequest) => usersApi.update(id, body),
    onSuccess: (user) => {
      qc.setQueryData(queryKeys.users.detail(id), user)
      void qc.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}

export function useSetUserPassword(id: number | string) {
  return useMutation({ mutationFn: (body: SetPasswordRequest) => usersApi.setPassword(id, body) })
}
