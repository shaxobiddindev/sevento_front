import { errorMessage } from '@/shared/api/errors'
import { openPdf, printPdf } from '@/shared/lib/print'
import { toast } from '@/shared/ui'

import { salesApi } from '../api/sales.api'

/** Chek PDF ni Authorization bilan oladi va chop etadi (yoki yangi oynada ochadi). */
export async function printReceipt(saleId: number, mode: 'print' | 'open' = 'print') {
  try {
    const blob = await salesApi.receipt(saleId)
    const filename = `chek-${saleId}.pdf`
    if (mode === 'print') printPdf(blob, filename)
    else openPdf(blob, filename)
  } catch (error) {
    toast.error(errorMessage(error))
  }
}
