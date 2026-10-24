import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useAuthStore } from '@/features/auth'
import { PageSpinner } from '@/shared/ui'

import { hasCapability } from '../layout/nav'
import { OfflineScreen } from '../pages/StatusPages'

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()
  if (status === 'idle' || status === 'loading') return <PageSpinner />
  if (status === 'offline') return <OfflineScreen />
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') return <PageSpinner />
  if (status === 'offline') return <OfflineScreen />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return children
}

/** Huquq bo'lmasa /403 (ro'yxat — birortasi yetarli). Backend baribir tekshiradi — bu qulaylik. */
export function RequireCapability({
  cap,
  children,
}: {
  cap: string | readonly string[]
  children: ReactNode
}) {
  const allowed = useAuthStore((s) => hasCapability(s.user?.capabilities ?? [], cap))
  if (!allowed) return <Navigate to="/403" replace />
  return children
}
