import { useEffect, type ReactNode } from 'react'

import { useAuthStore } from '@/features/auth'
import { queryClient } from '@/shared/api/queryClient'
import i18n from '@/shared/i18n'
import { formatNumber } from '@/shared/lib/money'
import {
  CLOSE_CODES,
  createInvalidator,
  RealtimeClient,
  realtimeApi,
  useRealtimeStore,
  websocketUrl,
  type RealtimeMessage,
} from '@/shared/realtime'
import { toast, useToastStore } from '@/shared/ui'

import { transferNotice } from './transferNotice'

const OFFLINE_POLL_MS = 30_000

/** Uzilganda muhim so'rovlar (meta.pollWhenOffline) har 30 s qayta o'qiladi. */
function startOfflinePolling() {
  return setInterval(() => {
    void queryClient.invalidateQueries({
      refetchType: 'active',
      predicate: (query) => query.meta?.pollWhenOffline === true,
    })
  }, OFFLINE_POLL_MS)
}

const TRANSFER_TOAST_MS = 10_000 // omborchi ko'rib ulgurishi uchun uzunroq

function handleSideEffects(message: RealtimeMessage) {
  const auth = useAuthStore.getState()
  const notice = transferNotice(message, auth.user)
  if (notice) {
    useToastStore.getState().push({ ...notice, duration: TRANSFER_TOAST_MS })
    return
  }
  switch (message.type) {
    case 'currency.rate_updated': {
      const rates =
        (message.payload.rates as { currency: string; rate: string }[] | undefined) ?? []
      const text = rates
        .map((r) => `${r.currency} = ${formatNumber(r.rate, 2)} ${i18n.t('currency:quoteSymbol')}`)
        .join(', ')
      toast.info(i18n.t('currency:rateUpdatedToast'), text)
      return
    }
    case 'stock.below_minimum': {
      const p = message.payload as {
        product_name?: string
        quantity?: string
        min_quantity?: string
        unit?: string
      }
      toast.warning(
        i18n.t('inventory:lowStockToast', { product: p.product_name ?? '' }),
        i18n.t('inventory:lowStockText', {
          quantity: formatNumber(p.quantity ?? '0', 3).replace(/,?0+$/, ''),
          unit: p.unit ?? '',
          min: formatNumber(p.min_quantity ?? '0', 3).replace(/,?0+$/, ''),
        }),
      )
      return
    }
    case 'debt.overdue': {
      const p = message.payload as {
        customer_name?: string
        amount_remaining?: string
        currency?: string
        days_overdue?: number
      }
      toast.warning(
        i18n.t('realtime:debtOverdue', { customer: p.customer_name ?? '' }),
        i18n.t('realtime:debtOverdueText', {
          amount: formatNumber(p.amount_remaining ?? '0', 2).replace(/,00$/, ''),
          currency: p.currency ?? '',
          days: p.days_overdue ?? 0,
        }),
      )
      return
    }
    case 'customer.credit_limit_warning': {
      const p = message.payload as {
        customer_name?: string
        percent?: string
        used_base?: string
        limit_base?: string
        base_currency?: string
      }
      toast.warning(
        i18n.t('realtime:creditWarning', { customer: p.customer_name ?? '' }),
        i18n.t('realtime:creditWarningText', {
          percent: formatNumber(p.percent ?? '0', 1),
          used: formatNumber(p.used_base ?? '0', 2),
          limit: formatNumber(p.limit_base ?? '0', 2),
          base: p.base_currency ?? '',
        }),
      )
      return
    }
    case 'report.ready': {
      const p = message.payload as { title?: string; format?: string }
      toast.success(
        i18n.t('reports:readyToast', { title: p.title ?? '' }),
        i18n.t('reports:readyToastText', { format: (p.format ?? '').toUpperCase() }),
      )
      return
    }
    case 'report.failed': {
      const p = message.payload as { title?: string; error?: string }
      toast.error(i18n.t('reports:failedToast', { title: p.title ?? '' }), p.error ?? '')
      return
    }
    case 'system.notice': {
      const level = String(message.payload.level ?? 'info') as 'info' | 'warning' | 'error'
      const show = toast[level] ?? toast.info
      show(i18n.t('realtime:notice.title'), String(message.payload.message ?? ''))
      return
    }
    case 'session.revoked': {
      if (message.payload.reason === 'deactivated') {
        void auth.logout().then(() => toast.warning(i18n.t('auth:sessionExpired')))
      } else {
        // huquq/nuqta/parol o'zgardi: me qayta o'qiladi, ulanish yangi ticket bilan qaytadi
        void auth.refreshUser().then((ok) => {
          if (ok) toast.info(i18n.t('realtime:sessionRefreshed'))
        })
      }
      return
    }
    default:
      return
  }
}

/** Login dan keyin WebSocket ochadi, logout da yopadi; xabarlar → kesh invalidate + toast. */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const authStatus = useAuthStore((s) => s.status)

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    const store = useRealtimeStore.getState()
    const invalidate = createInvalidator(queryClient)
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const client = new RealtimeClient({
      url: websocketUrl(),
      getTicket: async () => (await realtimeApi.ticket()).ticket,
      onStatus: (status) => {
        const previous = useRealtimeStore.getState().status
        store.setStatus(status)
        if (status === 'offline' && !pollTimer) pollTimer = startOfflinePolling()
        if (status !== 'offline' && pollTimer) {
          clearInterval(pollTimer)
          pollTimer = null
        }
        // uzilgan vaqtda o'tkazib yuborilgan o'zgarishlar uchun hammasi qayta o'qiladi
        if (status === 'online' && previous === 'offline') void queryClient.invalidateQueries()
      },
      onMessage: (message) => {
        store.touch()
        invalidate(message)
        handleSideEffects(message)
      },
      onClose: (code) => {
        if (code === CLOSE_CODES.TOO_MANY) toast.warning(i18n.t('realtime:tooManyConnections'))
      },
    })
    client.connect()

    return () => {
      client.close()
      if (pollTimer) clearInterval(pollTimer)
      useRealtimeStore.getState().setStatus('idle')
    }
  }, [authStatus])

  return children
}
