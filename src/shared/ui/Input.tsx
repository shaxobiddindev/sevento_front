import type { ComponentProps, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/cn'

const base =
  'block w-full rounded-md border bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:bg-slate-50 disabled:text-slate-500'

export interface InputProps extends ComponentProps<'input'> {
  invalid?: boolean
}

// React 19: `ref` oddiy prop — react-hook-form register() to'g'ridan-to'g'ri ishlaydi
export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      className={cn(base, 'h-10', invalid ? 'border-red-400' : 'border-slate-300', className)}
      {...rest}
    />
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(base, 'py-2', invalid ? 'border-red-400' : 'border-slate-300', className)}
      {...rest}
    />
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cn(base, 'h-10', invalid ? 'border-red-400' : 'border-slate-300', className)}
      {...rest}
    >
      {children}
    </select>
  )
}

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label?: string
}

export function Checkbox({ label, className, id, ...rest }: CheckboxProps) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input
        id={id}
        type="checkbox"
        className="size-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
        {...rest}
      />
      {label && <span>{label}</span>}
    </label>
  )
}

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-brand-700' : 'bg-slate-300',
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
