import { divRoundHalfUp, pow10, toScaled } from '@/shared/lib/decimal'

/**
 * Qaytarish summasi — server formulasi bilan bir xil (faqat ko'rsatish uchun):
 * round(L·(r+q)/Q) − round(L·r/Q) valyutaning kichik birligida (yarim yuqoriga).
 * Natija kichik birlikda (so'm — butun, USD — sent). Xato kiritish → null.
 */
export function returnAmountMinor(
  lineTotal: string,
  soldQty: string,
  returnedQty: string,
  qty: string,
  places: number,
): bigint | null {
  const total4 = toScaled(lineTotal, 4)
  const sold3 = toScaled(soldQty, 3)
  const before3 = toScaled(returnedQty, 3)
  const q3 = toScaled(qty, 3)
  if (total4 === null || !sold3 || before3 === null || q3 === null || q3 < 0n) return null
  const share = (x3: bigint) => divRoundHalfUp(total4 * x3 * pow10(places), pow10(4) * sold3)
  return share(before3 + q3) - share(before3)
}

/** Summa avval ochiq qarzdan ayiriladi, qolgani mijozga qaytariladi (kichik birlikda). */
export function splitRefund(totalMinor: bigint, debtRemaining: string | null, places: number) {
  const debt = debtRemaining === null ? 0n : (toScaled(debtRemaining, places) ?? 0n)
  const fromDebt = totalMinor < debt ? totalMinor : debt > 0n ? debt : 0n
  return { fromDebt, refund: totalMinor - fromDebt }
}
