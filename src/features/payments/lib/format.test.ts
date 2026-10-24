import { describe, expect, it } from 'vitest'

import { formatBalances } from './format'

describe('formatBalances', () => {
  it('valyuta kasr xonasi bilan', () => {
    expect(
      formatBalances(
        [
          { currency: 'UZS', amount: '125000.0000' },
          { currency: 'USD', amount: '5.0000' },
        ],
        { UZS: 0, USD: 2 },
      ).replace(/\u00A0/g, ' '),
    ).toBe('125 000 UZS · 5,00 USD')
    expect(formatBalances([], {})).toBe('—')
  })
})
