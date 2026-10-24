import { describe, expect, it } from 'vitest'

import { fitsPrecision, lineTotal, sumTotals } from './lines'

describe('purchase line helpers', () => {
  it('lineTotal float xatosisiz', () => {
    expect(lineTotal('3', '0.1')).toBe(0.3)
    expect(lineTotal('100', '0.80')).toBe(80)
    expect(lineTotal('1.255', '12500')).toBe(15687.5)
    expect(lineTotal('2,5', '1 200')).toBe(3000)
    expect(lineTotal('', '1')).toBeNull()
    expect(lineTotal('x', '1')).toBeNull()
  })

  it('sumTotals', () => {
    expect(
      sumTotals([
        { quantity: '100', unit_price: '0.8' },
        { quantity: '50', unit_price: '0.4' },
        { quantity: '', unit_price: '9' },
      ]),
    ).toBe(100)
  })

  it('fitsPrecision', () => {
    expect(fitsPrecision('10', 0)).toBe(true)
    expect(fitsPrecision('10.0', 0)).toBe(true)
    expect(fitsPrecision('1.5', 0)).toBe(false)
    expect(fitsPrecision('1,255', 3)).toBe(true)
    expect(fitsPrecision('1.2555', 3)).toBe(false)
  })
})
