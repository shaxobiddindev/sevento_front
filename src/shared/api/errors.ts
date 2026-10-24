import i18n from '@/shared/i18n'

export interface ApiErrorDetail {
  field: string | null
  code: string
  message: string
}

/** Backend ning yagona xato formati: {error: {code, message, details, request_id}}. */
export class ApiError extends Error {
  readonly name = 'ApiError'

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorDetail[] = [],
    readonly requestId = '',
  ) {
    super(message)
  }

  get isValidation() {
    return this.code === 'validation_error'
  }

  /** Maydon bo'yicha birinchi xabar: {"items.0.quantity": "..."} */
  fieldErrors(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const detail of this.details) {
      if (detail.field && !(detail.field in result)) result[detail.field] = detail.message
    }
    return result
  }

  nonFieldMessages(): string[] {
    return this.details.filter((d) => !d.field).map((d) => d.message)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Kod bo'yicha o'zbekcha matn; tarjima bo'lmasa serverdan kelgan xabar. */
export function localizeErrorCode(code: string, fallback?: string): string {
  return i18n.t(`errors:${code}`, { defaultValue: fallback || i18n.t('errors:unknown_error') })
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error
  if (error instanceof Error && error.name === 'AbortError') {
    return new ApiError(0, 'aborted', error.message)
  }
  return new ApiError(0, 'network_error', localizeErrorCode('network_error'))
}

/** Foydalanuvchiga ko'rsatiladigan matn (toast uchun). */
export function errorMessage(error: unknown): string {
  const apiError = toApiError(error)
  if (apiError.isValidation) {
    const nonField = apiError.nonFieldMessages()
    if (nonField.length) return nonField.join('. ')
    const first = apiError.details[0]
    if (first) return `${first.field}: ${first.message}`
  }
  return apiError.message
}
