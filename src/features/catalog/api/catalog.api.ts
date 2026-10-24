import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'
import type {
  Category,
  CategoryRequest,
  CategoryTree,
  ListParams,
  Paginated,
  PriceType,
  PriceTypeRequest,
  Product,
  ProductPatchRequest,
  ProductPrice,
  ProductWriteRequest,
  SetPriceRequest,
  Unit,
  UnitRequest,
} from '@/shared/api/types'

export const catalogApi = {
  categoryTree: () => api.get<CategoryTree[]>('/catalog/categories/tree/'),
  createCategory: (body: CategoryRequest) => api.post<Category>('/catalog/categories/', body),
  updateCategory: (id: number, body: Partial<CategoryRequest>) =>
    api.patch<Category>(`/catalog/categories/${id}/`, body),

  units: () => api.get<Unit[]>('/catalog/units/'),
  saveUnit: (id: number | undefined, body: UnitRequest) =>
    id ? api.patch<Unit>(`/catalog/units/${id}/`, body) : api.post<Unit>('/catalog/units/', body),

  priceTypes: () => api.get<PriceType[]>('/catalog/price-types/'),
  savePriceType: (id: number | undefined, body: PriceTypeRequest) =>
    id
      ? api.patch<PriceType>(`/catalog/price-types/${id}/`, body)
      : api.post<PriceType>('/catalog/price-types/', body),

  products: (params: ListParams) => api.get<Paginated<Product>>('/catalog/products/', params),
  product: (id: number | string, branch?: number | null) =>
    api.get<Product>(`/catalog/products/${id}/`, { branch: branch ?? undefined }),
  createProduct: (body: ProductWriteRequest) => api.post<Product>('/catalog/products/', body),
  updateProduct: (id: number | string, body: ProductPatchRequest) =>
    api.patch<Product>(`/catalog/products/${id}/`, body),
  priceHistory: (id: number | string) => api.get<ProductPrice[]>(`/catalog/products/${id}/prices/`),
  setPrice: (id: number | string, body: SetPriceRequest) =>
    api.post<ProductPrice>(`/catalog/products/${id}/set-price/`, body),
}

// --- kategoriyalar ---

export function useCategoryTree() {
  return useQuery({ queryKey: queryKeys.catalog.categoryTree, queryFn: catalogApi.categoryTree })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: CategoryRequest }) =>
      id ? catalogApi.updateCategory(id, body) : catalogApi.createCategory(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.catalog.categories })
      void qc.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

// --- ma'lumotnomalar ---

export function useUnits() {
  return useQuery({
    queryKey: queryKeys.catalog.units,
    queryFn: catalogApi.units,
    staleTime: 5 * 60_000,
  })
}

export function useSaveUnit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: UnitRequest }) => catalogApi.saveUnit(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.catalog.units }),
  })
}

export function usePriceTypes() {
  return useQuery({
    queryKey: queryKeys.catalog.priceTypes,
    queryFn: catalogApi.priceTypes,
    staleTime: 5 * 60_000,
  })
}

export function useSavePriceType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number; body: PriceTypeRequest }) =>
      catalogApi.savePriceType(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.catalog.priceTypes }),
  })
}

// --- tovarlar ---

export function useProducts(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.products.list(params),
    queryFn: () => catalogApi.products(params),
    placeholderData: (prev) => prev,
  })
}

export function useProduct(id: number | string | undefined, branch?: number | null) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? '', branch),
    queryFn: () => catalogApi.product(id!, branch),
    enabled: id !== undefined,
    placeholderData: (prev) => prev,
  })
}

export function usePriceHistory(id: number | string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.prices(id ?? ''),
    queryFn: () => catalogApi.priceHistory(id!),
    enabled: id !== undefined,
  })
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id?: number | string; body: ProductWriteRequest }) =>
      id ? catalogApi.updateProduct(id, body) : catalogApi.createProduct(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products.all }),
  })
}

export function useSetPrice(id: number | string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SetPriceRequest) => catalogApi.setPrice(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.products.all }),
  })
}
