import { beforeEach, describe, expect, it } from 'vitest'

import type { PosProduct } from '@/shared/api/types'

import { cartIsValid } from '../lib/cart'
import { useCartStore } from './cart'

const cola: PosProduct = {
  id: 1,
  sku: 'COLA',
  barcode: '4780001',
  name: 'Cola 1L',
  unit_code: 'dona',
  unit_decimal_places: 0,
  price: '10000.0000',
  stock: '20.000',
}
const sugar: PosProduct = {
  ...cola,
  id: 2,
  sku: 'SUGAR',
  name: 'Shakar',
  unit_code: 'kg',
  unit_decimal_places: 3,
}

describe('kassa savati', () => {
  beforeEach(() => {
    useCartStore.setState({ branchId: 1, currency: 'UZS', priceTypeId: 1, lines: [] })
  })

  it('bir xil tovar qayta skanerlansa miqdor oshadi', () => {
    const { add } = useCartStore.getState()
    add(cola)
    add(cola)
    add(sugar, '1.5')
    expect(useCartStore.getState().lines.map((l) => [l.product.id, l.quantity])).toEqual([
      [1, '2'],
      [2, '1.5'],
    ])
  })

  it("nuqta yoki valyuta o'zgarsa savat tozalanadi, o'zgarmasa saqlanadi", () => {
    useCartStore.getState().add(cola)
    useCartStore.getState().setContext({ branchId: 1, currency: 'UZS', priceTypeId: 1 })
    expect(useCartStore.getState().lines).toHaveLength(1)
    useCartStore.getState().setContext({ branchId: 1, currency: 'USD', priceTypeId: 1 })
    expect(useCartStore.getState().lines).toHaveLength(0)
  })

  it('narxlar yangilanganda qatorlar yangi narxni oladi', () => {
    useCartStore.getState().add(cola)
    useCartStore.getState().refreshProducts([{ ...cola, price: '11000.0000' }])
    expect(useCartStore.getState().lines[0].product.price).toBe('11000.0000')
  })

  it('tekshiruv: dona kasr emas, chegirma summadan oshmaydi, narxsiz tovar yo‘q', () => {
    const line = (p: PosProduct, quantity: string, discount = '') => ({
      product: p,
      quantity,
      discount,
    })
    expect(cartIsValid([line(cola, '2'), line(sugar, '1.250')], 0)).toBe(true)
    expect(cartIsValid([line(cola, '1.5')], 0)).toBe(false)
    expect(cartIsValid([line(cola, '0')], 0)).toBe(false)
    expect(cartIsValid([line(cola, '1', '10001')], 0)).toBe(false)
    expect(cartIsValid([line(cola, '1', '0.5')], 0)).toBe(false) // so'mda kasr yo'q
    expect(cartIsValid([line({ ...cola, price: null }, '1')], 0)).toBe(false)
    expect(cartIsValid([], 0)).toBe(false)
  })
})
