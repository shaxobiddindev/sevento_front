import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { cn } from '@/shared/lib/cn'
import { useRealtimeStore, type RealtimeStatus } from '@/shared/realtime'

const dot: Record<RealtimeStatus, string> = {
  online: 'bg-emerald-500',
  connecting: 'bg-amber-400 animate-pulse',
  offline: 'bg-red-500',
  idle: 'bg-slate-300',
}

export function ConnectionIndicator() {
  const { t } = useTranslation('realtime')
  const status = useRealtimeStore((s) => s.status)
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-slate-500"
      title={t(`status.${status}`)}
      data-status={status}
    >
      <span className={cn('inline-block size-2 rounded-full', dot[status])} />
      <span className="hidden sm:inline">{t(`status.${status}`)}</span>
    </span>
  )
}

const BANNER_AFTER_MS = 10_000

/** 10 s dan ortiq uzilgan bo'lsa — ogohlantirish banneri (polling ishlayotgani haqida). */
export function OfflineBanner() {
  const { t } = useTranslation('realtime')
  const online = useOnlineStatus()
  const offlineSince = useRealtimeStore((s) => s.offlineSince)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (offlineSince === null) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [offlineSince])

  if (!online) {
    // internet umuman yo'q — darhol (WebSocket uzilishini kutmasdan)
    return (
      <div
        role="alert"
        data-testid="offline-banner"
        className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900"
      >
        <WifiOff className="size-4 shrink-0" />
        {t('common:offline.banner')}
      </div>
    )
  }
  const show = offlineSince !== null && now - offlineSince >= BANNER_AFTER_MS
  if (!show) return null
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
    >
      <WifiOff className="size-4 shrink-0" />
      {t('banner')}
    </div>
  )
}
