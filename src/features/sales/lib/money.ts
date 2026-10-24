/**
 * Kassa hisob-kitobi — serverdagi qoidalarning aniq nusxasi (apps/sales/pricing.py, services.py).
 *
 *   qator  = yaxlitlash_yarim_yuqoriga(miqdor × narx, valyuta xonasi) − chegirma
 *   to'lov = yaxlitlash(summa × kurs(to'lov) / kurs(savdo), 4 xona)
 *   qaytim = pastga_yaxlitlash(to'langan − jami, valyuta xonasi)
 *
 * Yakuniy summa baribir serverdan; bu — ekranda ko'rsatish va expected_total uchun.
 */
import { divRoundHalfUp, pow10, toScaled } from '@/shared/lib/decimal'

export {
  amountToCover,
  ceilToMinor,
  convertTo4,
  fromScaled,
  minorToString,
  toScaled,
} from '@/shared/lib/decimal'

export function lineGross(quantity: string, price: string, places: number): bigint | null {
  const q = toScaled(quantity, 3)
  const p = toScaled(price, places)
  if (q === null || p === null) return null
  return divRoundHalfUp(q * p, 1000n)
}

export interface LineInput {
  quantity: string
  price: string
  discount: string
}

export interface Totals {
  subtotal: bigint
  discount: bigint
  total: bigint
}

/** Barcha summalar savdo valyutasining eng kichik birligida (so'm, sent). */
export function cartTotals(lines: LineInput[], places: number): Totals {
  let subtotal = 0n
  let discount = 0n
  for (const line of lines) {
    subtotal += lineGross(line.quantity, line.price, places) ?? 0n
    discount += toScaled(line.discount || '0', places) ?? 0n
  }
  return { subtotal, discount, total: subtotal - discount }
}

export interface PaymentState {
  paid4: bigint
  remaining4: bigint
  /** qaytim, savdo valyutasining eng kichik birligida */
  change: bigint
  /** ortiqcha summa naqd to'lovdan oshib ketdi (karta bilan ortiqcha to'lab bo'lmaydi) */
  changeNotCash: boolean
}

export function paymentState(
  totalMinor: bigint,
  places: number,
  paid4: bigint[],
  cashPaid4: bigint,
): PaymentState {
  const k = pow10(4 - places)
  const total4 = totalMinor * k
  const paid = paid4.reduce((a, b) => a + b, 0n)
  const over = paid - total4
  const change = over > 0n ? over / k : 0n
  return {
    paid4: paid,
    remaining4: over < 0n ? -over : 0n,
    change,
    changeNotCash: change * k > cashPaid4,
  }
}
