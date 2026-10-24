import { ChevronDown, X } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/cn'

import { Spinner } from './Spinner'

export interface ComboboxProps<T> {
  value: T | null
  onChange: (item: T | null) => void
  options: T[]
  getKey: (item: T) => string | number
  getLabel: (item: T) => string
  renderOption?: (item: T) => ReactNode
  /** Qidiruv matni o'zgarganda (ota komponent so'rov yuboradi — API faqat feature qatlamida) */
  onInputChange?: (text: string) => void
  loading?: boolean
  placeholder?: string
  emptyText?: string
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  'aria-label'?: string
}

/** Qidiruvli tanlagich: klaviatura (↑ ↓ Enter Esc), sichqoncha, tozalash. */
export function Combobox<T>({
  value,
  onChange,
  options,
  getKey,
  getLabel,
  renderOption,
  onInputChange,
  loading,
  placeholder,
  emptyText,
  invalid,
  disabled,
  autoFocus,
  className,
  'aria-label': ariaLabel,
}: ComboboxProps<T>) {
  const { t } = useTranslation()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)

  const openWith = (next: string) => {
    setText(next)
    setActive(0)
    setOpen(true)
    onInputChange?.(next)
  }

  const select = (item: T) => {
    onChange(item)
    setOpen(false)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) return openWith(text)
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && options[active]) {
        e.preventDefault()
        select(options[active])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setText('')
    }
  }

  const shown = open ? text : value ? getLabel(value) : ''

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        value={shown}
        placeholder={placeholder ?? t('actions.search')}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => openWith(e.target.value)}
        onFocus={() => !disabled && openWith('')}
        onBlur={() => {
          setOpen(false)
          setText('')
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'block h-10 w-full rounded-md border bg-white pr-14 pl-3 text-sm shadow-sm placeholder:text-slate-400',
          'focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-slate-50',
          invalid ? 'border-red-400' : 'border-slate-300',
        )}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-slate-400">
        {loading && <Spinner className="size-4" />}
        <ChevronDown className="size-4" />
      </span>
      {value && !disabled && !open && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute inset-y-0 right-7 flex items-center px-1 text-slate-400 hover:text-slate-600"
          aria-label={t('actions.reset')}
        >
          <X className="size-3.5" />
        </button>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          // fokus inputda qolsin (blur dan oldin tanlash ishlashi uchun)
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-30 mt-1 max-h-64 w-full min-w-64 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              {loading ? t('status.loading') : (emptyText ?? t('status.notFound'))}
            </li>
          )}
          {options.map((item, index) => (
            <li
              key={getKey(item)}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => select(item)}
              className={cn(
                'cursor-pointer px-3 py-2 text-sm',
                index === active ? 'bg-brand-50 text-brand-900' : 'text-slate-800',
              )}
            >
              {renderOption ? renderOption(item) : getLabel(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
