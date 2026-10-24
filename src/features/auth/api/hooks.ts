import { useMutation, useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api/queryKeys'

import { authApi } from './auth.api'

export function useCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: authApi.capabilities,
    staleTime: Infinity,
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: authApi.changePassword })
}
