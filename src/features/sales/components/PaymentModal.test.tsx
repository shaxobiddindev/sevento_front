import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import '@/shared/i18n'

import type { Currency, PaymentMethod } from '@/shared/api/types'

import { PaymentModal } from './PaymentModal'

const currencies = [
  { id: 1, code: 'USD', name: 'Dollar', decimal_places: 2, is_active: true, is_base: true },
  { id: 2, code: 'UZS', name: "So'm", decimal_places: 0, is_active: true, is_base: false },
] as Currency[]
const methods = [
  { id: 10, code: 'cash', name: 'Naqd pul', is_cash: true, is_active: true },
  { id: 11, code: 'card', name: 'Karta', is_cash: false, is_active: true },
] as PaymentMethod[]

function setup(credit?: { customerName: string; available4: bigint | null }) {
  const onConfirm = vi.fn()
  render(
    <PaymentModal
      totalMinor={142500n}
      saleCurrency="UZS"
      places={0}
      currencies={currencies}
      decimals={{ USD: 2, UZS: 0 }}
      rates={{ UZS: '1', USD: '12500' }}
      methods={methods}
      loading={false}
      error={null}
      credit={credit}
      canCredit
      onClose={() => {}}
      onConfirm={onConfirm}
    />,
  )
  return { onConfirm }
}

const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\u00A0/g, ' ')

describe("to'lov oynasi", () => {
  it("naqd to'lovda qaytim hisoblanadi va yuboriladi", () => {
    const { onConfirm } = setup()
    expect(text('pay-change')).toBe('0 UZS')
    fireEvent.change(screen.getByTestId('pay-amount-1'), { target: { value: '150 000' } })
    expect(text('pay-change')).toBe('7 500 UZS')
    fireEvent.click(screen.getByTestId('pay-confirm'))
    expect(onConfirm).toHaveBeenCalledWith([{ method: 10, currency: 2, amount: '150000' }], {
      dueDate: null,
    })
  })

  it("dollar + karta aralash: 'Qolganini' tugmasi aniq summani qo'yadi", () => {
    const { onConfirm } = setup()
    fireEvent.change(screen.getByTestId('pay-currency-1'), { target: { value: 'USD' } })
    fireEvent.change(screen.getByTestId('pay-amount-1'), { target: { value: '10' } })
    expect(text('pay-remaining')).toBe('17 500 UZS')
    fireEvent.click(screen.getByTestId('pay-add'))
    fireEvent.click(screen.getByTestId('pay-fill-2'))
    expect((screen.getByTestId('pay-amount-2') as HTMLInputElement).value).toBe('17500')
    fireEvent.click(screen.getByTestId('pay-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(
      [
        { method: 10, currency: 1, amount: '10' },
        { method: 11, currency: 2, amount: '17500' },
      ],
      { dueDate: null },
    )
  })

  it("karta bilan ortiqcha to'lab bo'lmaydi; yetishmasa tugma yopiq", () => {
    setup()
    fireEvent.change(screen.getByTestId('pay-method-1'), { target: { value: '11' } })
    fireEvent.change(screen.getByTestId('pay-amount-1'), { target: { value: '150000' } })
    expect(screen.getByTestId('pay-confirm')).toBeDisabled()
    fireEvent.change(screen.getByTestId('pay-amount-1'), { target: { value: '100000' } })
    expect(text('pay-remaining')).toBe('42 500 UZS')
    expect(screen.getByTestId('pay-confirm')).toBeDisabled()
  })
})

describe("to'lov oynasi: nasiya", () => {
  it("mijoz tanlangan bo'lsa qolgani nasiyaga, muddat bilan", () => {
    const { onConfirm } = setup({ customerName: 'Aliyev Vali', available4: 10_000_000_000n })
    fireEvent.change(screen.getByTestId('pay-amount-1'), { target: { value: '20000' } })
    expect(text('pay-credit')).toBe('122 500 UZS')
    fireEvent.change(screen.getByTestId('pay-due-date'), { target: { value: '2026-11-30' } })
    fireEvent.click(screen.getByTestId('pay-confirm'))
    expect(onConfirm).toHaveBeenCalledWith([{ method: 10, currency: 2, amount: '20000' }], {
      dueDate: '2026-11-30',
    })
  })

  it("to'liq nasiya: to'lov qatori o'chiriladi", () => {
    const { onConfirm } = setup({ customerName: 'Aliyev Vali', available4: null })
    fireEvent.click(screen.getByTestId('pay-remove-1'))
    expect(text('pay-credit')).toBe('142 500 UZS')
    fireEvent.click(screen.getByTestId('pay-confirm'))
    expect(onConfirm).toHaveBeenCalledWith([], { dueDate: null })
  })

  it('kredit limiti yetmasa tugma yopiq', () => {
    // mavjud 100 000 so'm, nasiya 122 500 bo'ladi
    setup({ customerName: 'Aliyev Vali', available4: 1_000_000_000n })
    fireEvent.change(screen.getByTestId('pay-amount-1'), { target: { value: '20000' } })
    expect(screen.getByTestId('pay-confirm')).toBeDisabled()
    expect(screen.getByText(/Kredit limiti yetmaydi/)).toBeInTheDocument()
  })
})
