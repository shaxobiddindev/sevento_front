import { describe, expect, it } from 'vitest'

import type { ReportFilter } from '@/shared/api/types'

import { periodPresets, resolveParams } from './params'

const f = (name: string, type: string, def: string | null = null): ReportFilter => ({
  name,
  type,
  label: name,
  required: false,
  choices: [],
  default: def,
})

describe('hisobot parametrlari', () => {
  const today = new Date(2026, 9, 23)

  it('default lar backend bilan bir xil: oy boshidan bugungacha, tanlov default, sarlavhadagi nuqta', () => {
    const filters = [
      f('date_from', 'date'),
      f('date_to', 'date'),
      f('branch', 'branch'),
      f('group_by', 'choice', 'day'),
    ]
    expect(resolveParams(filters, {}, 3, today)).toEqual({
      date_from: '2026-10-01',
      date_to: '2026-10-23',
      branch: '3',
      group_by: 'day',
    })
    // foydalanuvchi "Barcha nuqtalar" tanlasa (branch=all), sarlavhadagi nuqta qo'yilmaydi
    expect(resolveParams(filters, { branch: 'all', group_by: 'seller' }, 3, today)).toMatchObject({
      group_by: 'seller',
    })
    expect(resolveParams(filters, { branch: 'all' }, 3, today).branch).toBeUndefined()
    // ta'rifda yo'q parametr yuborilmaydi
    expect(resolveParams(filters, { foo: '1' }, null, today).foo).toBeUndefined()
  })

  it('tez davrlar', () => {
    const presets = Object.fromEntries(periodPresets(today).map((p) => [p.key, [p.from, p.to]]))
    expect(presets.week).toEqual(['2026-10-17', '2026-10-23'])
    expect(presets.lastMonth).toEqual(['2026-09-01', '2026-09-30'])
    expect(presets.yesterday).toEqual(['2026-10-22', '2026-10-22'])
  })
})
