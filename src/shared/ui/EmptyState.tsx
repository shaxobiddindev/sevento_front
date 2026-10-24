import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center text-slate-500">
      <Inbox className="size-8 text-slate-300" />
      <p className="text-sm">{text}</p>
      {action}
    </div>
  )
}
