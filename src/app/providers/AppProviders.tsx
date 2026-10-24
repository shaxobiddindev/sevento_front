import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'

import { useAuthStore } from '@/features/auth'
import { queryClient } from '@/shared/api/queryClient'
import { Toaster } from '@/shared/ui'

import { PwaUpdater } from './PwaUpdater'
import { RealtimeProvider } from './RealtimeProvider'

/** Ilova ochilganda refresh cookie orqali sessiyani tiklaydi. */
function AuthBootstrap({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const bootstrap = useAuthStore((s) => s.bootstrap)
  useEffect(() => {
    if (status === 'idle') void bootstrap()
  }, [status, bootstrap])
  return children
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <RealtimeProvider>{children}</RealtimeProvider>
      </AuthBootstrap>
      <Toaster />
      <PwaUpdater />
    </QueryClientProvider>
  )
}
