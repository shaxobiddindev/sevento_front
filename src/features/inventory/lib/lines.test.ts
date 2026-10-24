import { describe, expect, it } from 'vitest'

import { formatQty, newLine, splitLineErrors, toLineRequests, validateLines } from './lines'

const dona = { id: 1, name: 'Cola', sku: 'C1', unit_code: 'dona', unit_decimal_places: 0 }
const kg = { id: 2, name: 'Shakar', sku: 'S1', unit_code: 'kg', unit_decimal_places: 3 }

describe('hujjat qatorlari', () => {
  it("bo'sh, musbat emas, birlik aniqligi va takrorni topadi", () => {
    const errors = validateLines([
      newLine(null, '1'),
      newLine(dona, '0'),
      newLine(dona, '1,5'),
      newLine(kg, '2,125'),
      newLine(kg, '1'),
    ])
    expect(errors).toEqual({
      0: { product: 'required' },
      1: { quantity: 'positive' },
      2: { product: 'duplicate', quantity: 'precision' },
      4: { product: 'duplicate' },
    })
  })

  it("so'rovga vergulli kasr nuqtaga o'tadi, tovarsiz qator tashlanadi", () => {
    expect(toLineRequests([newLine(kg, '2,5'), newLine(null, '3')])).toEqual([
      { product: 2, quantity: '2.5' },
    ])
  })

  it('server xatolari qatorlarga taqsimlanadi', () => {
    const { lines, rest } = splitLineErrors([
      { field: 'items.1.quantity', message: 'Mavjud: 20' },
      { field: 'to_branch', message: 'Boshqa nuqta' },
      { field: null, message: 'umumiy' },
    ])
    expect(lines).toEqual({ 1: { quantity: 'Mavjud: 20' } })
    expect(rest.map((r) => r.message)).toEqual(['Boshqa nuqta', 'umumiy'])
  })

  it('miqdor ortiqcha nollarsiz', () => {
    expect(formatQty('12.500', 3)).toBe('12,5')
    expect(formatQty('10.000', 3)).toBe('10')
    expect(formatQty('7', 0)).toBe('7')
    expect(formatQty(null)).toBe('—')
  })
})
