import i18n from '@/shared/i18n'
import type { Me } from '@/shared/api/types'
import type { RealtimeMessage } from '@/shared/realtime'
import type { ToastKind } from '@/shared/ui/toast'

interface TransferPayload {
  number?: string
  from_branch_id?: number
  from_branch_name?: string
  to_branch_id?: number
  to_branch_name?: string
  actor_id?: number | null
  items_count?: number
  has_discrepancy?: boolean
  discrepancies?: { product_name: string; quantity: string; quantity_received: string }[]
  previous_status?: string
  reason?: string
}

export interface Notice {
  kind: ToastKind
  title: string
  description: string
}

const trim = (value: string) => (value.includes('.') ? value.replace(/\.?0+$/, '') : value)

/**
 * Ko'chirish xabari kimga toast bo'lib ko'rinadi (keshni yangilash hammaga):
 *  - jo'natildi → qabul qiluvchi nuqta omborchisiga
 *  - qabul qilindi → jo'natuvchiga; farq bo'lsa rahbarga ham (ogohlantirish)
 *  - jo'natilgani bekor qilindi → qabul qiluvchiga
 * O'zi qilgan amal haqida toast chiqmaydi.
 */
export function transferNotice(message: RealtimeMessage, user: Me | null): Notice | null {
  if (!user || !message.type.startsWith('transfer.')) return null
  const p = message.payload as TransferPayload
  if (p.actor_id === user.id) return null
  const can = (code: string) => user.capabilities.includes(code)
  const inBranch = (id?: number) => user.all_branches || user.branches.some((b) => b.id === id)
  const names = {
    number: p.number ?? '',
    from: p.from_branch_name ?? '',
    to: p.to_branch_name ?? '',
  }

  switch (message.type) {
    case 'transfer.sent':
      if (!can('inventory.transfers.receive') || !inBranch(p.to_branch_id)) return null
      return {
        kind: 'info',
        title: i18n.t('realtime:transferIncoming', names),
        description: i18n.t('realtime:transferIncomingText', {
          ...names,
          count: p.items_count ?? 0,
        }),
      }
    case 'transfer.received': {
      const sender = can('inventory.transfers.create') && inBranch(p.from_branch_id)
      if (p.has_discrepancy && (sender || can('dashboard.view'))) {
        const items = (p.discrepancies ?? [])
          .map((d) => `${d.product_name} ${trim(d.quantity_received)}/${trim(d.quantity)}`)
          .join(', ')
        return {
          kind: 'warning',
          title: i18n.t('realtime:transferShortage', names),
          description: i18n.t('realtime:transferShortageText', { ...names, items }),
        }
      }
      if (!sender) return null
      return {
        kind: 'success',
        title: i18n.t('realtime:transferReceived', names),
        description: i18n.t('realtime:transferReceivedText', names),
      }
    }
    case 'transfer.cancelled':
      if (p.previous_status !== 'sent') return null
      if (!can('inventory.transfers.receive') || !inBranch(p.to_branch_id)) return null
      return {
        kind: 'warning',
        title: i18n.t('realtime:transferCancelled', names),
        description: i18n.t('realtime:transferCancelledText', { ...names, reason: p.reason ?? '' }),
      }
    default:
      return null
  }
}
