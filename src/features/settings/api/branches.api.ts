import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type {
  Branch,
  BranchPatchRequest,
  BranchRequest,
  ListParams,
  Paginated,
} from '@/shared/api/types'

export const branchesApi = {
  list: (params: ListParams = {}) => api.get<Paginated<Branch>>('/branches/', params),
  create: (body: BranchRequest) => api.post<Branch>('/branches/', body),
  update: (id: number | string, body: BranchPatchRequest) =>
    api.patch<Branch>(`/branches/${id}/`, body),
}

export function useBranches(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.branches.list(params),
    queryFn: () => branchesApi.list(params),
    placeholderData: (prev) => prev,
  })
}

export function useAllBranches() {
  return useQuery({
    queryKey: queryKeys.branches.list({ page_size: 100 }),
    queryFn: () => branchesApi.list({ page_size: 100 }),
    select: (data) => data.results,
  })
}

export function useCreateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: branchesApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.branches.all }),
  })
}

export function useUpdateBranch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: BranchPatchRequest }) =>
      branchesApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.branches.all }),
  })
}
