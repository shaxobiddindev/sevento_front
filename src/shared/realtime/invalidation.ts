/**
 * WebSocket xabar turi → qaysi TanStack Query keshlari invalidate qilinadi (docs/realtime.md jadvali).
 * Xabar ishlovchilari komponentlarda emas, faqat shu yerda. Tez-tez keladigan turlar debounce bilan.
 */
import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { queryKeys } from '@/shared/api/queryKeys'

import type { RealtimeMessage } from './client'

type Payload = Record<string, unknown>

interface Rule {
  keys: (payload: Payload) => QueryKey[]
  /** Shu vaqt ichida kelgan bir xil kalitlar bitta invalidate ga yig'iladi */
  debounceMs?: number
}

export const invalidationRules: Record<string, Rule> = {
  'session.revoked': { keys: () => [queryKeys.me] },
  'system.notice': { keys: () => [] },
  'currency.rate_updated': { keys: () => [queryKeys.currency.all, queryKeys.products.all] },
  // Ombor: qoldiq, harakatlar, partiyalar bitta kalit ostida (kirim/savdo ko'p qatorli bo'lsa ham bitta so'rov)
  // kassa qidiruvidagi qoldiq ham shu xabar bilan yangilanadi (ikki kassada sinxron)
  'stock.changed': {
    keys: () => [queryKeys.inventory.all, queryKeys.sales.posAll],
    debounceMs: 1500,
  },
  'stock.below_minimum': { keys: () => [queryKeys.inventory.all] },
  'dashboard.updated': {
    keys: () => [queryKeys.sales.summaryAll, queryKeys.sales.lists, queryKeys.dashboard.all],
    debounceMs: 2000,
  },
  // to'lov (savdo ham) — kassa qoldig'i, jurnal, savdolar ro'yxati, kunlik xulosa
  'payment.received': {
    keys: () => [queryKeys.payments.all, queryKeys.sales.lists, queryKeys.sales.summaryAll],
    debounceMs: 1000,
  },
  'payment.refunded': {
    keys: () => [queryKeys.payments.all, queryKeys.sales.lists, queryKeys.sales.summaryAll],
    debounceMs: 1000,
  },
  // nasiya: mijoz kartasi, qarzlar ro'yxati (payments.* kalitlari) va savdolar
  'debt.changed': {
    keys: () => [queryKeys.payments.all, queryKeys.sales.lists],
    debounceMs: 1000,
  },
  'debt.overdue': { keys: () => [queryKeys.payments.all], debounceMs: 1000 },
  'customer.credit_limit_warning': {
    keys: (p) => [queryKeys.payments.customer(String(p.customer_id ?? ''))],
  },
  // kassa smenasi, qo'lda kirim-chiqim
  'cash.updated': { keys: () => [queryKeys.payments.all], debounceMs: 500 },
  // ko'chirish holati ikkala nuqtada (ro'yxat, hujjat, menyudagi "kutilmoqda" soni, qoldiq)
  'transfer.sent': { keys: () => [queryKeys.inventory.all] },
  'transfer.received': { keys: () => [queryKeys.inventory.all] },
  'transfer.cancelled': { keys: () => [queryKeys.inventory.all] },
  // qaytarish: savdolar (qaytarilgan summa), qaytarishlar ro'yxati, kassa/qarz
  'sale_return.completed': {
    keys: () => [queryKeys.sales.all, queryKeys.payments.all],
    debounceMs: 500,
  },
  // fondagi hisobot: "Tayyorlangan fayllar" ro'yxati (toast — RealtimeProvider)
  'report.ready': { keys: () => [queryKeys.reports.jobs] },
  'report.failed': { keys: () => [queryKeys.reports.jobs] },
}

export function keysFor(message: RealtimeMessage): QueryKey[] | null {
  const rule = invalidationRules[message.type]
  return rule ? rule.keys(message.payload ?? {}) : null
}

/** Xabar → invalidate; noma'lum tur jim e'tiborsiz (eski mijoz yangi server bilan buzilmaydi). */
export function createInvalidator(queryClient: QueryClient) {
  const pending = new Map<
    string,
    { keys: Map<string, QueryKey>; timer: ReturnType<typeof setTimeout> }
  >()

  const flush = (type: string) => {
    const bucket = pending.get(type)
    if (!bucket) return
    pending.delete(type)
    bucket.keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }))
  }

  return (message: RealtimeMessage): boolean => {
    const rule = invalidationRules[message.type]
    if (!rule) return false
    const keys = rule.keys(message.payload ?? {})
    if (!keys.length) return true
    if (!rule.debounceMs) {
      keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }))
      return true
    }
    let bucket = pending.get(message.type)
    if (!bucket) {
      bucket = {
        keys: new Map(),
        timer: setTimeout(() => flush(message.type), rule.debounceMs),
      }
      pending.set(message.type, bucket)
    }
    keys.forEach((key) => bucket!.keys.set(JSON.stringify(key), key))
    return true
  }
}
