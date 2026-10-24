import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '@/shared/api/queryKeys'

import { createInvalidator, invalidationRules } from './invalidation'

describe('createInvalidator', () => {
  let qc: QueryClient
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    qc = new QueryClient()
    spy = vi.spyOn(qc, 'invalidateQueries')
    invalidationRules['test.fast'] = { keys: (p) => [['items', p.id]] }
    invalidationRules['test.slow'] = { keys: (p) => [['stock', p.branch]], debounceMs: 1000 }
  })

  afterEach(() => {
    delete invalidationRules['test.fast']
    delete invalidationRules['test.slow']
    vi.useRealTimers()
  })

  it("noma'lum tur jim e'tiborsiz", () => {
    const invalidate = createInvalidator(qc)
    expect(invalidate({ type: 'nope', payload: {}, timestamp: '' })).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })

  it('debounce siz tur darhol invalidate qiladi', () => {
    const invalidate = createInvalidator(qc)
    invalidate({ type: 'test.fast', payload: { id: 7 }, timestamp: '' })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['items', 7] })
  })

  it("debounce li tur bir xil kalitlarni yig'ib bir marta invalidate qiladi", () => {
    const invalidate = createInvalidator(qc)
    for (let i = 0; i < 20; i++)
      invalidate({ type: 'test.slow', payload: { branch: 1 }, timestamp: '' })
    invalidate({ type: 'test.slow', payload: { branch: 2 }, timestamp: '' })
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith({ queryKey: ['stock', 1] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['stock', 2] })
  })
})

describe('ombor xabarlari', () => {
  afterEach(() => vi.useRealTimers())

  it("stock.changed ko'p qatorli kirimda bitta invalidate ga yig'iladi", () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    const invalidate = createInvalidator(qc)
    for (let product = 1; product <= 30; product++)
      invalidate({
        type: 'stock.changed',
        payload: { branch_id: 1, product_id: product },
        timestamp: '',
      })
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1500)
    // 30 ta xabar → har kalit bir martadan (ombor + kassa qidiruvi)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.inventory.all })
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.sales.posAll })
  })

  it('stock.below_minimum qoldiqni darhol yangilaydi', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    createInvalidator(qc)({ type: 'stock.below_minimum', payload: {}, timestamp: '' })
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.inventory.all })
  })
})

describe("savdo va to'lov xabarlari", () => {
  it('stock.changed kassa qidiruvidagi qoldiqni ham yangilaydi', () => {
    expect(invalidationRules['stock.changed'].keys({})).toContainEqual(queryKeys.sales.posAll)
  })

  it("to'lov kelganda kassa va savdolar ro'yxati yangilanadi", () => {
    const keys = invalidationRules['payment.received'].keys({})
    expect(keys).toContainEqual(queryKeys.payments.all)
    expect(keys).toContainEqual(queryKeys.sales.lists)
    expect(invalidationRules['dashboard.updated'].keys({})).toContainEqual(
      queryKeys.sales.summaryAll,
    )
  })
})

describe('nasiya va kassa xabarlari', () => {
  it("qarz o'zgarsa va kassa yangilansa payments keshlari yangilanadi", () => {
    expect(invalidationRules['debt.changed'].keys({})).toContainEqual(queryKeys.payments.all)
    expect(invalidationRules['cash.updated'].keys({})).toContainEqual(queryKeys.payments.all)
    expect(invalidationRules['customer.credit_limit_warning'].keys({ customer_id: 7 })).toEqual([
      queryKeys.payments.customer('7'),
    ])
  })
})

describe('ombor hujjatlari va qaytarish', () => {
  it("ko'chirish holati o'zgarsa ombor keshlari (ro'yxat, hujjat, kutilayotganlar) yangilanadi", () => {
    for (const type of ['transfer.sent', 'transfer.received', 'transfer.cancelled']) {
      expect(invalidationRules[type].keys({})).toEqual([queryKeys.inventory.all])
    }
    // hujjat kalitlari ['inventory'] ostida — bitta invalidate yetadi
    expect(queryKeys.inventory.transfer(5)[0]).toBe('inventory')
    expect(queryKeys.inventory.incomingTransfers[0]).toBe('inventory')
  })

  it('qaytarishda savdolar va kassa yangilanadi', () => {
    const keys = invalidationRules['sale_return.completed'].keys({})
    expect(keys).toContainEqual(queryKeys.sales.all)
    expect(keys).toContainEqual(queryKeys.payments.all)
  })
})
