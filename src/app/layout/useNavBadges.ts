import { useQuery } from '@tanstack/react-query'

import { useAuthStore } from '@/features/auth'
import { api } from '@/shared/api/client'
import { queryKeys } from '@/shared/api/queryKeys'

import type { NavItem } from './nav'

/**
 * Menyu nishonlari. Ombor modulini import qilmaydi (u alohida chunk da qolsin) — kalit umumiy,
 * shuning uchun transfer.* xabari ['inventory'] ni yangilaganda nishon ham yangilanadi.
 */
export function useNavBadges(): Record<NonNullable<NavItem['badge']>, number> {
  const canReceive = useAuthStore(
    (s) => s.user?.capabilities.includes('inventory.transfers.receive') ?? false,
  )
  const incoming = useQuery({
    queryKey: queryKeys.inventory.incomingTransfers,
    queryFn: () => api.get<{ count: number }>('/inventory/transfers/incoming/'),
    enabled: canReceive,
    staleTime: 60_000,
    meta: { pollWhenOffline: true },
  })
  return { incomingTransfers: incoming.data?.count ?? 0 }
}
