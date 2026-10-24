import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime, toIsoDate } from './date'
import { formatMoney, formatNumber, parseDecimalInput, toDecimalInput } from './money'

const NB = '\u00A0'

describe('formatNumber / formatMoney', () => {
  it("o'zbekcha: minglik bo'sh joy, kasr vergul", () => {
    expect(formatNumber('12650.450000', 2)).toBe(`12${NB}650,45`)
    expect(formatNumber(1234567.891, 3)).toBe(`1${NB}234${NB}567,891`)
    expect(formatNumber('5500.0000', 0)).toBe(`5${NB}500`)
    expect(formatNumber(0, 2)).toBe('0,00')
    expect(formatNumber(-1500.5, 1)).toBe(`-1${NB}500,5`)
  })

  it("bo'sh va noto'g'ri qiymatlar", () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber('')).toBe('—')
    expect(formatNumber('abc')).toBe('abc')
    expect(formatMoney(undefined, 'UZS')).toBe('—')
  })

  it('valyuta bilan', () => {
    expect(formatMoney('0.9', 'USD', 2)).toBe('0,90 USD')
  })

  it('kiritilgan sonni API formatiga', () => {
    expect(parseDecimalInput(`12${NB}650,45`)).toBe('12650.45')
    expect(parseDecimalInput(' 5 500 ')).toBe('5500')
    expect(parseDecimalInput('7.25')).toBe('7.25')
  })
})

describe('formatDate / formatDateTime', () => {
  it('faqat sana satri vaqt zonasi siljishisiz', () => {
    expect(formatDate('2026-10-22')).toBe('22.10.2026')
  })

  it('sana va vaqt (mahalliy)', () => {
    const d = new Date(2026, 9, 5, 9, 7)
    expect(formatDateTime(d)).toBe('05.10.2026 09:07')
    expect(formatDate(d)).toBe('05.10.2026')
    expect(toIsoDate(d)).toBe('2026-10-05')
  })

  it("bo'sh/noto'g'ri", () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDateTime('xato')).toBe('—')
  })
})

describe('toDecimalInput', () => {
  it('API qiymatini vergulli forma qiymatiga aylantiradi', () => {
    expect(toDecimalInput('25.500')).toBe('25,5')
    expect(toDecimalInput('100.000')).toBe('100')
    expect(toDecimalInput(null)).toBe('')
    expect(parseDecimalInput(toDecimalInput('0.4500'))).toBe('0.45')
  })
})
