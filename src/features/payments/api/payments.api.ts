import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, newIdempotencyKey } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type {
  CashEntryWriteRequest,
  CashFlowCategory,
  Cashbox,
  CashShift,
  CashTransaction,
  CurrentShift,
  Customer,
  CustomerDetail,
  CustomerWriteRequest,
  Debt,
  DebtPaymentWriteRequest,
  LedgerEntry,
  ListParams,
  Paginated,
  PaymentDetail,
  PaymentList,
  PaymentMethod,
  PaymentMethodRequest,
  Payoff,
  ShiftCloseRequest,
} from '@/shared/api/types'

export const paymentsApi = {
  methods: () => api.get<PaymentMethod[]>('/payments/methods/'),
  createMethod: (body: PaymentMethodRequest) => api.post<PaymentMethod>('/payments/methods/', body),
  updateMethod: (id: number, body: Partial<PaymentMethodRequest>) =>
    api.patch<PaymentMethod>(`/payments/methods/${id}/`, body),
  categories: () => api.get<CashFlowCategory[]>('/payments/cash-categories/'),
  cashboxes: (params: { branch?: number | null }) =>
    api.get<Cashbox[]>('/payments/cashboxes/', { branch: params.branch ?? undefined }),
  transactions: (params: ListParams) =>
    api.get<Paginated<CashTransaction>>('/payments/cash-transactions/', params),
  cashEntry: (body: CashEntryWriteRequest) =>
    api.post<CashTransaction>('/payments/cash-transactions/', body),
  customers: (params: ListParams) => api.get<Paginated<Customer>>('/payments/customers/', params),
  customer: (id: number | string) => api.get<CustomerDetail>(`/payments/customers/${id}/`),
  createCustomer: (body: CustomerWriteRequest) =>
    api.post<CustomerDetail>('/payments/customers/', body),
  updateCustomer: (id: number, body: Partial<CustomerWriteRequest>) =>
    api.patch<CustomerDetail>(`/payments/customers/${id}/`, body),
  ledger: (id: number | string, params: ListParams) =>
    api.get<Paginated<LedgerEntry>>(`/payments/customers/${id}/ledger/`, params),
  payoff: (id: number | string, currency: string) =>
    api.get<Payoff>(`/payments/customers/${id}/payoff/`, { currency }),
  payDebt: (id: number, body: DebtPaymentWriteRequest, idempotencyKey: string) =>
    api.post<PaymentDetail>(`/payments/customers/${id}/pay/`, body, { idempotencyKey }),
  debts: (params: ListParams) => api.get<Paginated<Debt>>('/payments/debts/', params),
  payments: (params: ListParams) => api.get<Paginated<PaymentList>>('/payments/payments/', params),
  payment: (id: number | string) => api.get<PaymentDetail>(`/payments/payments/${id}/`),
  refund: (id: number, reason: string) =>
    api.post<PaymentDetail>(`/payments/payments/${id}/refund/`, { reason }),
  shifts: (params: ListParams) => api.get<Paginated<CashShift>>('/payments/shifts/', params),
  currentShift: (branch: number) => api.get<CurrentShift>('/payments/shifts/current/', { branch }),
  openShift: (branch: number, note = '') =>
    api.post<CashShift>('/payments/shifts/open/', { branch, note }),
  closeShift: (id: number, body: ShiftCloseRequest) =>
    api.post<CashShift>(`/payments/shifts/${id}/close/`, body),
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: queryKeys.payments.methods,
    queryFn: paymentsApi.methods,
    staleTime: 5 * 60_000,
  })
}

export function useSavePaymentMethod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: PaymentMethodRequest }) =>
      id ? paymentsApi.updateMethod(id, body) : paymentsApi.createMethod(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.payments.methods }),
  })
}

export function useCashCategories(enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments.categories,
    queryFn: paymentsApi.categories,
    staleTime: 10 * 60_000,
    enabled,
  })
}

/** Kassa qoldig'i; to'lov kelganda (payment.received) realtime bilan yangilanadi. */
export function useCashboxes(params: { branch?: number | null }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments.cashboxes(params),
    queryFn: () => paymentsApi.cashboxes(params),
    enabled,
    meta: { pollWhenOffline: true },
  })
}

export function useCashTransactions(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.payments.transactions(params),
    queryFn: () => paymentsApi.transactions(params),
    placeholderData: keepPreviousData,
  })
}

// --- mijozlar va qarzlar ---

export function useCustomers(params: ListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.payments.customers(params),
    queryFn: () => paymentsApi.customers(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Mijoz kartasi: kredit holati, qarzlar — to'lov kelganda (payment.received) yangilanadi. */
export function useCustomer(id: number | string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.payments.customer(id ?? ''),
    queryFn: () => paymentsApi.customer(id!),
    enabled: id !== null && id !== undefined && id !== '',
    meta: { pollWhenOffline: true },
  })
}

export function useSaveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: Partial<CustomerWriteRequest> }) =>
      id
        ? paymentsApi.updateCustomer(id, body)
        : paymentsApi.createCustomer(body as CustomerWriteRequest),
    onSuccess: (customer) => {
      qc.setQueryData(queryKeys.payments.customer(customer.id), customer)
      void qc.invalidateQueries({ queryKey: ['payments', 'customers'] })
    },
  })
}

export function useCustomerLedger(id: number | string, params: ListParams) {
  return useQuery({
    queryKey: queryKeys.payments.ledger(id, params),
    queryFn: () => paymentsApi.ledger(id, params),
    placeholderData: keepPreviousData,
  })
}

export function usePayoff(id: number | string, currency: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.payments.payoff(id, currency),
    queryFn: () => paymentsApi.payoff(id, currency),
    enabled: enabled && !!currency,
  })
}

/** Qarz to'lovi; har oyna ochilishiga bitta Idempotency-Key (qayta yuborishda ikki to'lov bo'lmaydi). */
export function usePayDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      customerId,
      body,
      idempotencyKey = newIdempotencyKey(),
    }: {
      customerId: number
      body: DebtPaymentWriteRequest
      idempotencyKey?: string
    }) => paymentsApi.payDebt(customerId, body, idempotencyKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.payments.all })
      void qc.invalidateQueries({ queryKey: queryKeys.sales.all })
    },
  })
}

export function useDebts(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.payments.debts(params),
    queryFn: () => paymentsApi.debts(params),
    placeholderData: keepPreviousData,
    meta: { pollWhenOffline: true },
  })
}

export function usePaymentsJournal(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.payments.payments(params),
    queryFn: () => paymentsApi.payments(params),
    placeholderData: keepPreviousData,
    meta: { pollWhenOffline: true },
  })
}

export function usePayment(id: number | null) {
  return useQuery({
    queryKey: queryKeys.payments.payment(id ?? ''),
    queryFn: () => paymentsApi.payment(id!),
    enabled: id !== null,
  })
}

export function useRefundPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => paymentsApi.refund(id, reason),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
  })
}

// --- smena va qo'lda yozuv ---

export function useCurrentShift(branch: number | null) {
  return useQuery({
    queryKey: queryKeys.payments.currentShift(branch),
    queryFn: () => paymentsApi.currentShift(branch!),
    enabled: branch !== null,
    meta: { pollWhenOffline: true },
  })
}

export function useShifts(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.payments.shifts(params),
    queryFn: () => paymentsApi.shifts(params),
    placeholderData: keepPreviousData,
  })
}

export function useOpenShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ branch, note }: { branch: number; note?: string }) =>
      paymentsApi.openShift(branch, note),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
  })
}

export function useCloseShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: ShiftCloseRequest }) =>
      paymentsApi.closeShift(id, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
  })
}

export function useCashEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: paymentsApi.cashEntry,
    onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.payments.all }),
  })
}
