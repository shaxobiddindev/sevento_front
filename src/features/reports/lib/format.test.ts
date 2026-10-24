import { describe, expect, it } from 'vitest'

import type { ReportColumn } from '@/shared/api/types'

import { formatCell as raw } from './format'

// Intl guruhlash bo'shlig'i (NBSP / tor NBSP) → oddiy bo'shliq
const formatCell = (...args: Parameters<typeof raw>) => raw(...args).replace(/[\u00a0\u202f]/g, ' ')

const col = (over: Partial<ReportColumn>): ReportColumn => ({
  key: 'x',
  label: 'X',
  type: 'text',
  decimals: 2,
  decimals_key: null,
  total: false,
  ...over,
})

describe('hisobot katagi formati', () => {
  it("pul — 2 xona, qatordagi valyuta xonasi bilan (so'm — butun)", () => {
    expect(formatCell(col({ type: 'money' }), '12650.4500')).toBe('12 650,45')
    expect(formatCell(col({ type: 'money', decimals_key: '_dp' }), '50000.0000', { _dp: 0 })).toBe(
      '50 000',
    )
  })

  it('miqdor ortiqcha nollarsiz, foiz belgisi bilan', () => {
    expect(formatCell(col({ type: 'quantity', decimals: 3 }), '11.000')).toBe('11')
    expect(formatCell(col({ type: 'quantity', decimals: 3 }), '1.500')).toBe('1,5')
    expect(formatCell(col({ type: 'quantity', decimals: 3 }), '0')).toBe('0')
    // dona (0 xona): butun sonning oxiridagi nol kesilmaydi
    const dona = col({ type: 'quantity', decimals: 3, decimals_key: '_qdp' })
    expect(formatCell(dona, '40.000', { _qdp: 0 })).toBe('40')
    expect(formatCell(dona, '1000.000', { _qdp: 0 })).toBe('1 000')
    expect(formatCell(dona, '-20.000', { _qdp: 0 })).toBe('-20')
    expect(formatCell(col({ type: 'percent', decimals: 1 }), '49.4')).toBe('49,4%')
  })

  it("sana va bo'sh qiymat", () => {
    expect(formatCell(col({ type: 'date' }), '2026-10-23')).toBe('23.10.2026')
    expect(formatCell(col({ type: 'money' }), null)).toBe('')
  })
})
