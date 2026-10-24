import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type {
  Currency,
  CurrencyPatchRequest,
  CurrencyRequest,
  ExchangeRate,
  FetchResult,
  LatestRate,
  ListParams,
  Paginated,
  RateCreateRequest,
} from '@/shared/api/types'

export const currencyApi = {
  currencies: () => api.get<Currency[]>('/currencies/'),
  createCurrency: (body: CurrencyRequest) => api.post<Currency>('/currencies/', body),
  updateCurrency: (id: number, body: CurrencyPatchRequest) =>
    api.patch<Currency>(`/currencies/${id}/`, body),
  latest: () => api.get<LatestRate[]>('/currency-rates/latest/'),
  rates: (params: ListParams) => api.get<Paginated<ExchangeRate>>('/currency-rates/', params),
  setRate: (body: RateCreateRequest) => api.post<ExchangeRate>('/currency-rates/', body),
  fetch: () => api.post<FetchResult>('/currency-rates/fetch/'),
}

export function useCurrencies() {
  return useQuery({
    queryKey: queryKeys.currency.currencies,
    queryFn: currencyApi.currencies,
    staleTime: 5 * 60_000,
  })
}

/** Faol valyutalar va kod → kasr xonalari xaritasi (pulni formatlash uchun). */
export function useActiveCurrencies() {
  const query = useCurrencies()
  return useMemo(() => {
    const active = (query.data ?? []).filter((c) => c.is_active)
    const decimals: Record<string, number> = {}
    for (const c of query.data ?? []) decimals[c.code] = c.decimal_places ?? 2
    const base = query.data?.find((c) => c.is_base)?.code ?? ''
    return { currencies: active, decimals, base, isPending: query.isPending }
  }, [query.data, query.isPending])
}

export function useLatestRates() {
  return useQuery({
    queryKey: queryKeys.currency.latest,
    queryFn: currencyApi.latest,
    meta: { pollWhenOffline: true },
  })
}

export function useRateHistory(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.currency.rates(params),
    queryFn: () => currencyApi.rates(params),
    placeholderData: (prev) => prev,
  })
}

export function useSetRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: currencyApi.setRate,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.currency.all }),
  })
}

export function useFetchRates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: currencyApi.fetch,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.currency.all }),
  })
}

export function useSaveCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: CurrencyRequest }) =>
      id ? currencyApi.updateCurrency(id, body) : currencyApi.createCurrency(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.currency.all }),
  })
}
