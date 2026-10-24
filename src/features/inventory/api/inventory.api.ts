import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type { Batch, ListParams, Paginated, StockLevel, StockMovement } from '@/shared/api/types'

export const inventoryApi = {
  stock: (params: ListParams) => api.get<Paginated<StockLevel>>('/inventory/stock/', params),
  setMinQuantity: (id: number, minQuantity: string | null) =>
    api.patch<StockLevel>(`/inventory/stock/${id}/`, { min_quantity: minQuantity }),
  batches: (params: ListParams) => api.get<Paginated<Batch>>('/inventory/batches/', params),
  movements: (params: ListParams) =>
    api.get<Paginated<StockMovement>>('/inventory/movements/', params),
}

// Qoldiq jonli yangilanadi (stock.changed → ['inventory'] invalidate); uzilganda polling.
const live = { meta: { pollWhenOffline: true } }

export function useStock(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.inventory.stock(params),
    queryFn: () => inventoryApi.stock(params),
    placeholderData: (prev) => prev,
    enabled,
    ...live,
  })
}

export function useBatches(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.inventory.batches(params),
    queryFn: () => inventoryApi.batches(params),
    enabled,
    ...live,
  })
}

export function useMovements(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.movements(params),
    queryFn: () => inventoryApi.movements(params),
    placeholderData: (prev) => prev,
    ...live,
  })
}

export function useSetMinQuantity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, minQuantity }: { id: number; minQuantity: string | null }) =>
      inventoryApi.setMinQuantity(id, minQuantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventory.all }),
  })
}
