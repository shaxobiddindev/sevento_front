import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, newIdempotencyKey } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type {
  BranchBrief,
  CountedWriteRequest,
  ListParams,
  Paginated,
  StockCountCreateRequest,
  StockCountItem,
  StockCountList,
  TransferDetail,
  TransferList,
  TransferReceiveRequest,
  TransferWriteRequest,
  WriteOffDetail,
  WriteOffList,
  WriteOffReason,
  WriteOffReasonRequest,
  WriteOffWriteRequest,
} from '@/shared/api/types'

/** Ko'chirish, inventarizatsiya, hisobdan chiqarish — ombor hujjatlari. */
export const documentsApi = {
  transfers: (params: ListParams) =>
    api.get<Paginated<TransferList>>('/inventory/transfers/', params),
  transfer: (id: number | string) => api.get<TransferDetail>(`/inventory/transfers/${id}/`),
  incoming: () => api.get<{ count: number }>('/inventory/transfers/incoming/'),
  destinations: () => api.get<BranchBrief[]>('/inventory/transfers/destinations/'),
  saveTransfer: (id: number | string | undefined, body: TransferWriteRequest) =>
    id
      ? api.put<TransferDetail>(`/inventory/transfers/${id}/`, body)
      : api.post<TransferDetail>('/inventory/transfers/', body),
  sendTransfer: (id: number | string) =>
    api.post<TransferDetail>(`/inventory/transfers/${id}/send/`, undefined, {
      idempotencyKey: newIdempotencyKey(),
    }),
  receiveTransfer: (id: number | string, body: TransferReceiveRequest) =>
    api.post<TransferDetail>(`/inventory/transfers/${id}/receive/`, body, {
      idempotencyKey: newIdempotencyKey(),
    }),
  cancelTransfer: (id: number | string, reason: string) =>
    api.post<TransferDetail>(`/inventory/transfers/${id}/cancel/`, { reason }),

  counts: (params: ListParams) => api.get<Paginated<StockCountList>>('/inventory/counts/', params),
  count: (id: number | string) => api.get<StockCountList>(`/inventory/counts/${id}/`),
  countItems: (id: number | string, params: ListParams) =>
    api.get<Paginated<StockCountItem>>(`/inventory/counts/${id}/items/`, params),
  createCount: (body: StockCountCreateRequest) =>
    api.post<StockCountList>('/inventory/counts/', body),
  setCounted: (id: number | string, body: CountedWriteRequest) =>
    api.post<StockCountList>(`/inventory/counts/${id}/counted/`, body),
  completeCount: (id: number | string) =>
    api.post<StockCountList>(`/inventory/counts/${id}/complete/`, undefined, {
      idempotencyKey: newIdempotencyKey(),
    }),
  cancelCount: (id: number | string) => api.post<StockCountList>(`/inventory/counts/${id}/cancel/`),

  reasons: () => api.get<WriteOffReason[]>('/inventory/write-off-reasons/'),
  saveReason: (id: number | undefined, body: WriteOffReasonRequest) =>
    id
      ? api.patch<WriteOffReason>(`/inventory/write-off-reasons/${id}/`, body)
      : api.post<WriteOffReason>('/inventory/write-off-reasons/', body),
  writeOffs: (params: ListParams) =>
    api.get<Paginated<WriteOffList>>('/inventory/write-offs/', params),
  writeOff: (id: number | string) => api.get<WriteOffDetail>(`/inventory/write-offs/${id}/`),
  createWriteOff: (body: WriteOffWriteRequest) =>
    api.post<WriteOffDetail>('/inventory/write-offs/', body, {
      idempotencyKey: newIdempotencyKey(),
    }),
  cancelWriteOff: (id: number | string, reason: string) =>
    api.post<WriteOffDetail>(`/inventory/write-offs/${id}/cancel/`, { reason }),
}

// Holat boshqa nuqtada o'zgarsa WebSocket (transfer.*, stock.changed) ['inventory'] ni yangilaydi
const live = { meta: { pollWhenOffline: true } }

function useInvalidateInventory() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.inventory.all })
}

// --- ko'chirish ---

export function useTransfers(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.transfers(params),
    queryFn: () => documentsApi.transfers(params),
    placeholderData: (prev) => prev,
    ...live,
  })
}

export function useTransfer(id: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.transfer(id ?? ''),
    queryFn: () => documentsApi.transfer(id!),
    enabled: id !== undefined,
    ...live,
  })
}

/** Menyu nishoni: foydalanuvchi nuqtalariga jo'natilgan, hali qabul qilinmaganlar. */
export function useIncomingTransfersCount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory.incomingTransfers,
    queryFn: documentsApi.incoming,
    enabled,
    staleTime: 60_000,
    ...live,
  })
}

/** Qabul qiluvchi nuqtalar — barcha faol nuqtalar (foydalanuvchi biriktirilmaganlari ham). */
export function useTransferDestinations(enabled = true) {
  return useQuery({
    queryKey: ['inventory', 'transfer-destinations'],
    queryFn: documentsApi.destinations,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useSaveTransfer() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number | string; body: TransferWriteRequest }) =>
      documentsApi.saveTransfer(id, body),
    onSuccess: invalidate,
  })
}

export function useSendTransfer() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: documentsApi.sendTransfer, onSuccess: invalidate })
}

export function useReceiveTransfer() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TransferReceiveRequest }) =>
      documentsApi.receiveTransfer(id, body),
    onSuccess: invalidate,
  })
}

export function useCancelTransfer() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      documentsApi.cancelTransfer(id, reason),
    onSuccess: invalidate,
  })
}

// --- inventarizatsiya ---

export function useCounts(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.counts(params),
    queryFn: () => documentsApi.counts(params),
    placeholderData: (prev) => prev,
  })
}

export function useCount(id: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.count(id ?? ''),
    queryFn: () => documentsApi.count(id!),
    enabled: id !== undefined,
  })
}

export function useCountItems(id: number | string, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.countItems(id, params),
    queryFn: () => documentsApi.countItems(id, params),
    placeholderData: (prev) => prev,
  })
}

export function useCreateCount() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: documentsApi.createCount, onSuccess: invalidate })
}

export function useSetCounted(id: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CountedWriteRequest) => documentsApi.setCounted(id, body),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.inventory.count(id), data)
      void qc.invalidateQueries({ queryKey: ['inventory', 'count', String(id), 'items'] })
    },
  })
}

export function useCompleteCount() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: documentsApi.completeCount, onSuccess: invalidate })
}

export function useCancelCount() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: documentsApi.cancelCount, onSuccess: invalidate })
}

// --- hisobdan chiqarish ---

export function useWriteOffReasons() {
  return useQuery({
    queryKey: queryKeys.inventory.writeOffReasons,
    queryFn: documentsApi.reasons,
    staleTime: 5 * 60_000,
  })
}

export function useSaveWriteOffReason() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: WriteOffReasonRequest }) =>
      documentsApi.saveReason(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.inventory.writeOffReasons }),
  })
}

export function useWriteOffs(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.inventory.writeOffs(params),
    queryFn: () => documentsApi.writeOffs(params),
    placeholderData: (prev) => prev,
  })
}

export function useWriteOff(id: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.writeOff(id ?? ''),
    queryFn: () => documentsApi.writeOff(id!),
    enabled: id !== undefined,
  })
}

export function useCreateWriteOff() {
  const invalidate = useInvalidateInventory()
  return useMutation({ mutationFn: documentsApi.createWriteOff, onSuccess: invalidate })
}

export function useCancelWriteOff() {
  const invalidate = useInvalidateInventory()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      documentsApi.cancelWriteOff(id, reason),
    onSuccess: invalidate,
  })
}
