/**
 * Aniq o'nlik arifmetika (BigInt) — pul summalari serverdagi Decimal qoidalari bilan bir xil
 * yaxlitlansin (float xatosi yo'q). Valyuta konvertatsiyasi: summa × kurs(dan) / kurs(ga), 4 xona;
 * kurslar "1 birlik = N so'm" (6 xona).
 */
import { parseDecimalInput } from '@/shared/lib/money'

const TEN = 10n

export function pow10(n: number): bigint {
  return TEN ** BigInt(n)
}

export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  if (n < 0n) return -divRoundHalfUp(-n, d)
  return (n * 2n + d) / (2n * d)
}

export function divCeil(n: bigint, d: bigint): bigint {
  return n <= 0n ? n / d : (n + d - 1n) / d
}

/** "12 500,5" → 125005 (scale=1). Ortiqcha xonalar yarim yuqoriga yaxlitlanadi; xato → null. */
export function toScaled(value: string | number | null | undefined, scale: number): bigint | null {
  if (value === null || value === undefined) return null
  const text = parseDecimalInput(String(value))
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(text)
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) return null
  const [, sign, int = '', frac = ''] = match
  let result: bigint
  if (frac.length <= scale) {
    result = BigInt((int || '0') + frac.padEnd(scale, '0'))
  } else {
    const digits = BigInt((int || '0') + frac)
    result = divRoundHalfUp(digits, pow10(frac.length - scale))
  }
  return sign === '-' ? -result : result
}

/** 125005n, scale 1 → "12500.5" (API ga yuborish uchun). */
export function fromScaled(value: bigint, scale: number): string {
  const negative = value < 0n
  const digits = (negative ? -value : value).toString().padStart(scale + 1, '0')
  const int = scale ? digits.slice(0, -scale) : digits
  const frac = scale ? digits.slice(-scale) : ''
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

/** To'lov summasi → savdo valyutasida, 4 xona (server bilan bir xil yaxlitlash). */
export function convertTo4(
  amount: string,
  rateFrom: string,
  rateTo: string,
  sameCurrency: boolean,
): bigint | null {
  const a = toScaled(amount, 4)
  if (a === null) return null
  if (sameCurrency) return a
  const rf = toScaled(rateFrom, 6)
  const rt = toScaled(rateTo, 6)
  if (rf === null || rt === null || rt === 0n) return null
  return divRoundHalfUp(a * rf, rt)
}

/** Qolgan summani boshqa valyutada yopish uchun kerakli eng kichik summa (yuqoriga yaxlitlab). */
export function amountToCover(
  remaining4: bigint,
  payPlaces: number,
  rateFrom: string,
  rateTo: string,
  sameCurrency: boolean,
): string {
  if (remaining4 <= 0n) return '0'
  const unit = pow10(4 - payPlaces)
  if (sameCurrency) return fromScaled(divCeil(remaining4, unit), payPlaces)
  const rf = toScaled(rateFrom, 6)
  const rt = toScaled(rateTo, 6)
  if (rf === null || rt === null || rf === 0n) return '0'
  let minor = divCeil(divCeil(remaining4 * rt, rf), unit)
  // yaxlitlash tufayli kam chiqsa — bitta birlik qo'shiladi
  while ((convertTo4(fromScaled(minor, payPlaces), rateFrom, rateTo, false) ?? 0n) < remaining4) {
    minor += 1n
  }
  return fromScaled(minor, payPlaces)
}

/** BigInt eng kichik birlik → ko'rsatish uchun satr ("142500" yoki "11.40"). */

export function minorToString(value: bigint, places: number): string {
  return fromScaled(value, places)
}

/** 4 xonali summa → savdo valyutasining eng kichik birligi, yuqoriga (qolgan summani ko'rsatish). */

export function ceilToMinor(value4: bigint, places: number): bigint {
  return divCeil(value4, pow10(4 - places))
}
