import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { isApiError } from '@/shared/api/errors'
import { toast } from '@/shared/ui/toast'

/**
 * Backend validatsiya xatolarini formaga tarqatadi: maydonli → setError, maydonsiz → toast.
 * Maydon nomi formada bo'lmasa (masalan ichki yo'l) ham toast ko'rsatiladi.
 * knownFields — ro'yxat yoki predikat (field array uchun: f => f.startsWith('items.')).
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields?: readonly string[] | ((field: string) => boolean),
): void {
  const isKnown = (field: string) =>
    !knownFields ||
    (typeof knownFields === 'function' ? knownFields(field) : knownFields.includes(field))
  if (!isApiError(error)) {
    toast.error(error instanceof Error ? error.message : String(error))
    return
  }
  if (!error.isValidation) {
    toast.error(error.message)
    return
  }
  const unmatched: string[] = []
  for (const detail of error.details) {
    const field = detail.field
    if (field && isKnown(field)) {
      setError(field as Path<T>, { type: detail.code, message: detail.message })
    } else {
      unmatched.push(field ? `${field}: ${detail.message}` : detail.message)
    }
  }
  if (unmatched.length) toast.error(unmatched.join('\n'))
}
