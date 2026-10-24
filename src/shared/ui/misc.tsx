import { Search } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDebounce } from '@/shared/hooks/useDebounce'
import { cn } from '@/shared/lib/cn'

import { Input } from './Input'

type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'brand'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-sky-100 text-sky-800',
  brand: 'bg-brand-100 text-brand-800',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useTranslation()
  return (
    <Badge tone={active ? 'success' : 'neutral'}>
      {active ? t('status.active') : t('status.inactive')}
    </Badge>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-slate-200 bg-white p-5 shadow-sm', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/** Debounce bilan qidiruv maydoni (URL parametr bilan ishlash uchun qulay). */
export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(value)
  // Tashqi qiymat o'zgarsa (masalan "Tozalash") — render paytida moslashtirish
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value)
  }
  const debounced = useDebounce(text, 350)

  useEffect(() => {
    if (debounced !== value) onChange(debounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? t('actions.search')}
        className="pl-9"
      />
    </div>
  )
}
