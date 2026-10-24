import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

import { cn } from '@/shared/lib/cn'

import { useToastStore, type ToastKind } from './toast'

const styles: Record<ToastKind, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  error: { icon: XCircle, className: 'border-red-200 bg-red-50 text-red-900' },
  warning: { icon: AlertTriangle, className: 'border-amber-200 bg-amber-50 text-amber-900' },
  info: { icon: Info, className: 'border-sky-200 bg-sky-50 text-sky-900' },
}

export function Toaster() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  if (!items.length) return null
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4">
      {items.map((item) => {
        const { icon: Icon, className } = styles[item.kind]
        return (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
              className,
            )}
          >
            <Icon className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              {item.description && <p className="mt-0.5 text-sm opacity-80">{item.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded p-0.5 opacity-60 hover:opacity-100"
              aria-label="Yopish"
            >
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
