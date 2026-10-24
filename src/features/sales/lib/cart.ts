import { fitsPrecision, parseDecimalInput } from '@/shared/lib/money'

import type { CartLine } from '../store/cart'
import { lineGross, toScaled } from './money'

export { fitsPrecision }

/** Savatni serverga yuborishdan oldingi tekshiruv (miqdor, aniqlik, chegirma). Ombor — serverda. */
export function cartIsValid(lines: CartLine[], places: number): boolean {
  if (!lines.length) return false
  return lines.every((line) => {
    const qty = Number(parseDecimalInput(line.quantity))
    if (!Number.isFinite(qty) || qty <= 0) return false
    if (!fitsPrecision(line.quantity, line.product.unit_decimal_places)) return false
    if (line.product.price === null) return false
    const discount = toScaled(line.discount || '0', places)
    const gross = lineGross(line.quantity, line.product.price, places)
    if (discount === null || gross === null || discount < 0n || discount > gross) return false
    return fitsPrecision(line.discount || '0', places)
  })
}
