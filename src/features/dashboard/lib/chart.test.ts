import { describe, expect, it } from 'vitest'

import { colorFor, compact, OTHER, SERIES } from './chart'

describe('grafik yordamchilari', () => {
  it('ixcham son', () => {
    expect(compact(950)).toBe('950')
    expect(compact(4.74)).toBe('4,74')
    expect(compact(2.5)).toBe('2,5')
    expect(compact(157.2)).toBe('157')
    expect(compact(12_000)).toBe('12K')
    expect(compact(1_250_000)).toBe('1,3M')
    expect(compact(1_500)).toBe('1,5K')
  })

  it("rang obyektga bog'liq — boshqa tur yo'qolsa ham o'zgarmaydi", () => {
    const order = ['Naqd pul', 'Karta', "O'tkazma"]
    expect(colorFor('Karta', order)).toBe(SERIES[1])
    expect(colorFor('Noma’lum', order)).toBe(OTHER)
  })
})
