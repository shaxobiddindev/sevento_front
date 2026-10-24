import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, newIdempotencyKey } from '@/shared/api/client'
import { isApiError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/queryKeys'
import type {
  CostPreview,
  ExpenseType,
  ExpenseTypeRequest,
  ListParams,
  Paginated,
  PurchaseDetail,
  PurchaseList,
  PurchaseWriteRequest,
  Supplier,
  SupplierRequest,
} from '@/shared/api/types'

export const purchasingApi = {
  suppliers: (params: ListParams) => api.get<Paginated<Supplier>>('/purchasing/suppliers/', params),
  saveSupplier: (id: number | undefined, body: SupplierRequest) =>
    id
      ? api.patch<Supplier>(`/purchasing/suppliers/${id}/`, body)
      : api.post<Supplier>('/purchasing/suppliers/', body),
  expenseTypes: () => api.get<ExpenseType[]>('/purchasing/expense-types/'),
  saveExpenseType: (id: number | undefined, body: ExpenseTypeRequest) =>
    id
      ? api.patch<ExpenseType>(`/purchasing/expense-types/${id}/`, body)
      : api.post<ExpenseType>('/purchasing/expense-types/', body),

  purchases: (params: ListParams) =>
    api.get<Paginated<PurchaseList>>('/purchasing/purchases/', params),
  purchase: (id: number | string) => api.get<PurchaseDetail>(`/purchasing/purchases/${id}/`),
  preview: (id: number | string) => api.get<CostPreview>(`/purchasing/purchases/${id}/preview/`),
  create: (body: PurchaseWriteRequest) => api.post<PurchaseDetail>('/purchasing/purchases/', body),
  update: (id: number | string, body: PurchaseWriteRequest) =>
    api.put<PurchaseDetail>(`/purchasing/purchases/${id}/`, body),
  receive: (id: number | string) =>
    api.post<PurchaseDetail>(`/purchasing/purchases/${id}/receive/`, undefined, {
      idempotencyKey: newIdempotencyKey(),
    }),
  cancel: (id: number | string, reason: string) =>
    api.post<PurchaseDetail>(`/purchasing/purchases/${id}/cancel/`, { reason }),
}

// --- yetkazib beruvchilar, xarajat turlari ---

export function useSuppliers(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.purchasing.suppliers(params),
    queryFn: () => purchasingApi.suppliers(params),
    placeholderData: (prev) => prev,
  })
}

export function useSaveSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: SupplierRequest }) =>
      purchasingApi.saveSupplier(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.purchasing.all }),
  })
}

export function useExpenseTypes() {
  return useQuery({
    queryKey: queryKeys.purchasing.expenseTypes,
    queryFn: purchasingApi.expenseTypes,
    staleTime: 5 * 60_000,
  })
}

export function useSaveExpenseType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: ExpenseTypeRequest }) =>
      purchasingApi.saveExpenseType(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.purchasing.expenseTypes }),
  })
}

// --- kirimlar ---

export function usePurchases(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.purchasing.purchases(params),
    queryFn: () => purchasingApi.purchases(params),
    placeholderData: (prev) => prev,
  })
}

export function usePurchase(id: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.purchasing.purchase(id ?? ''),
    queryFn: () => purchasingApi.purchase(id!),
    enabled: id !== undefined,
  })
}

/** Qoralama tannarx hisobi; kurs bo'lmasa (409 rate_unavailable) — xato sifatida qaytadi. */
export function useCostPreview(id: number | string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.purchasing.preview(id ?? ''),
    queryFn: () => purchasingApi.preview(id!),
    enabled: id !== undefined && enabled,
    retry: (count, error) => !(isApiError(error) && error.status === 409) && count < 1,
  })
}

function useInvalidatePurchasing() {
  const qc = useQueryClient()
  return (detail?: PurchaseDetail) => {
    if (detail) qc.setQueryData(queryKeys.purchasing.purchase(detail.id), detail)
    void qc.invalidateQueries({ queryKey: queryKeys.purchasing.all })
  }
}

export function useSavePurchase() {
  const refresh = useInvalidatePurchasing()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number | string; body: PurchaseWriteRequest }) =>
      id ? purchasingApi.update(id, body) : purchasingApi.create(body),
    onSuccess: refresh,
  })
}

export function useReceivePurchase() {
  const qc = useQueryClient()
  const refresh = useInvalidatePurchasing()
  return useMutation({
    mutationFn: (id: number | string) => purchasingApi.receive(id),
    onSuccess: (detail) => {
      refresh(detail)
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.all })
    },
  })
}

export function useCancelPurchase() {
  const qc = useQueryClient()
  const refresh = useInvalidatePurchasing()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason: string }) =>
      purchasingApi.cancel(id, reason),
    onSuccess: (detail) => {
      refresh(detail)
      void qc.invalidateQueries({ queryKey: queryKeys.inventory.all })
    },
  })
}
