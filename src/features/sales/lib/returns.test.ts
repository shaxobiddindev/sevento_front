import { describe, expect, it } from 'vitest'

import { returnAmountMinor, splitRefund } from './returns'

describe('qaytarish summasi', () => {
  it("chegirmali qator bo'lib qaytarilsa yig'indi aynan qator summasiga teng (server bilan bir xil)", () => {
    // 3 dona, chegirma bilan 29 000 so'm — backend testidagi 9667 / 9666 / 9667
    const parts = ['0', '1', '2'].map((before) =>
      returnAmountMinor('29000.0000', '3.000', before, '1', 0),
    )
    expect(parts).toEqual([9667n, 9666n, 9667n])
  })

  it('dollarda sentgacha, kasr miqdor bilan', () => {
    // 2,5 kg × 1,20 = 3,00 USD; 1 kg qaytarish = 1,20
    expect(returnAmountMinor('3.0000', '2.500', '0', '1', 2)).toBe(120n)
  })

  it("noto'g'ri kiritish — null", () => {
    expect(returnAmountMinor('100', '2', '0', 'abc', 0)).toBeNull()
  })

  it('avval qarzdan, qolgani pul bilan', () => {
    expect(splitRefund(70000n, '50000.0000', 0)).toEqual({ fromDebt: 50000n, refund: 20000n })
    expect(splitRefund(30000n, '50000.0000', 0)).toEqual({ fromDebt: 30000n, refund: 0n })
    expect(splitRefund(30000n, null, 0)).toEqual({ fromDebt: 0n, refund: 30000n })
  })
})
