import { describe, expect, it } from 'vitest'

import {
  amountToCover,
  cartTotals,
  convertTo4,
  fromScaled,
  lineGross,
  paymentState,
  toScaled,
} from './money'

describe('kassa hisob-kitobi (server qoidalari)', () => {
  it("sonlarni aniq o'qiydi va yozadi", () => {
    expect(toScaled('12 500,5', 1)).toBe(125005n)
    expect(toScaled('1.5', 3)).toBe(1500n)
    expect(toScaled('0.125', 2)).toBe(13n) // yarim yuqoriga
    expect(toScaled('abc', 2)).toBeNull()
    expect(toScaled('', 2)).toBeNull()
    expect(fromScaled(125005n, 1)).toBe('12500.5')
    expect(fromScaled(5n, 2)).toBe('0.05')
    expect(fromScaled(142500n, 0)).toBe('142500')
  })

  it('qator va jami: kg × narx yaxlitlanadi, chegirma ayriladi', () => {
    expect(lineGross('1.5', '15000', 0)).toBe(22500n)
    expect(lineGross('1.255', '0.99', 2)).toBe(124n) // 1,24245 → 1,24
    expect(lineGross('0.333', '1000', 0)).toBe(333n)
    const totals = cartTotals(
      [
        { quantity: '12', price: '10000.0000', discount: '' },
        { quantity: '1.5', price: '15000', discount: '500' },
      ],
      0,
    )
    expect(totals).toEqual({ subtotal: 142500n, discount: 500n, total: 142000n })
  })

  it('katta summalarda ham aniq (float emas)', () => {
    expect(lineGross('999999.999', '999999999', 0)).toBe(999999998000000n)
  })

  it('aralash valyuta, qaytim va qolgan summa', () => {
    // 142 500 so'm: 10 USD (12 500) naqd + 17 500 so'm karta
    const usd = convertTo4('10', '12500', '1', false)!
    expect(usd).toBe(1250000000n) // 125 000,0000
    const card = convertTo4('17500', '1', '1', true)!
    expect(paymentState(142500n, 0, [usd, card], usd)).toEqual({
      paid4: 1425000000n,
      remaining4: 0n,
      change: 0n,
      changeNotCash: false,
    })
    // 150 000 naqd → qaytim 7 500
    const cash = convertTo4('150000', '1', '1', true)!
    expect(paymentState(142500n, 0, [cash], cash).change).toBe(7500n)
    // karta bilan ortiqcha — ruxsat yo'q
    expect(paymentState(142500n, 0, [cash], 0n).changeNotCash).toBe(true)
    // yetishmaydi
    expect(paymentState(142500n, 0, [card], 0n).remaining4).toBe(1250000000n)
  })

  it('boshqa valyutada yopish uchun summa yuqoriga yaxlitlanadi', () => {
    // 87 000 so'm USD da (12 650,45): 6,877... → 6,88
    expect(amountToCover(870000000n, 2, '12650.45', '1', false)).toBe('6.88')
    expect(amountToCover(1425000000n, 0, '1', '1', true)).toBe('142500')
    // USD savdo, so'mda to'lash: 11,40 USD × 12 500 = 142 500
    expect(amountToCover(114000n, 0, '1', '12500', false)).toBe('142500')
  })
})
