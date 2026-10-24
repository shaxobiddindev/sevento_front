import type { Product } from '@/shared/api/types'

/** Hujjat qatorlari uchun tovarning minimal ko'rinishi (saqlangan hujjatdan ham tiklanadi). */
export interface PickedProduct {
  id: number
  name: string
  sku: string
  unit_code: string
  unit_decimal_places: number
}

export function toPickedProduct(p: Product): PickedProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit_code: p.unit_code,
    unit_decimal_places: p.unit_decimal_places,
  }
}
