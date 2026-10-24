import { Loader2 } from 'lucide-react'

import { cn } from '@/shared/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} aria-hidden="true" />
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center text-brand-700">
      <Spinner className="size-8" />
    </div>
  )
}
