/**
 * Yagona HTTP klient: Bearer access token, avtomatik refresh (bir vaqtda bitta),
 * 401/403 boshqaruvi, yagona xato formati → ApiError, Idempotency-Key.
 *
 * Komponentlar bu faylni to'g'ridan-to'g'ri ishlatmaydi — faqat features/*\/api/ dagi
 * TanStack Query hooklari orqali.
 */
import { env } from '@/shared/config/env'

import { ApiError, localizeErrorCode } from './errors'
import { tokenStore } from './tokenStore'

type Primitive = string | number | boolean | null | undefined
export type QueryParams = Record<string, Primitive | Primitive[]>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: QueryParams
  headers?: HeadersInit
  idempotencyKey?: string
  signal?: AbortSignal
  /** 'blob' — PDF/Excel kabi fayllar uchun; 'auto' — fayl yoki JSON (javob turiga qarab) */
  responseType?: 'json' | 'blob' | 'auto'
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

/** Hisobot eksporti: fayl darhol (200) yoki fon vazifasi haqida JSON (202). */
export type FileOrJson<T> = { kind: 'file'; file: DownloadedFile } | { kind: 'json'; data: T }

function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return match ? decodeURIComponent(match[1]) : fallback
}

type Transport = (input: string, init: RequestInit) => Promise<Response>

// Tauri da @tauri-apps/plugin-http bilan almashtiriladi (cookie jari o'zida)
let transport: Transport = (input, init) => fetch(input, init)

export function setTransport(custom: Transport) {
  transport = custom
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${env.apiBase}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (item === undefined || item === null || item === '') continue
      params.append(key, String(item))
    }
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

type ErrorBody = {
  error?: { code?: string; message?: string; details?: unknown; request_id?: string }
}

async function readJson(response: Response): Promise<ErrorBody | null> {
  try {
    return (await response.json()) as ErrorBody
  } catch {
    return null
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const body = await readJson(response)
  const error = body?.error
  if (error && typeof error.code === 'string') {
    return new ApiError(
      response.status,
      error.code,
      localizeErrorCode(error.code, error.message),
      Array.isArray(error.details) ? (error.details as ApiError['details']) : [],
      error.request_id ?? '',
    )
  }
  const code = response.status >= 500 ? 'server_error' : 'unknown_error'
  return new ApiError(response.status, code, localizeErrorCode(code))
}

// Bu endpointlarda 401 kelsa refresh urinilmaydi (o'zlari sessiya boshqaruvi)
const NO_REFRESH_PATHS = ['/auth/login/', '/auth/refresh/', '/auth/logout/']

let refreshPromise: Promise<string | null> | null = null

/**
 * Refresh cookie bilan yangi access oladi. Parallel chaqiruvlar bitta so'rovni kutadi.
 * `null` — sessiya yo'q (cookie yo'q yoki eskirgan). Tarmoq uzilgan yoki server ishlamayotgan
 * bo'lsa `ApiError` (network_error / server_error) tashlanadi — bu chiqish (logout) emas:
 * aloqa tiklangach sessiya davom etadi.
 */
export function refreshAccess(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let response: Response
      try {
        response = await transport(buildUrl('/auth/refresh/'), {
          method: 'POST',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
      } catch {
        throw new ApiError(0, 'network_error', localizeErrorCode('network_error'))
      }
      if (response.status >= 500) throw await parseError(response)
      if (!response.ok) {
        tokenStore.clear()
        return null
      }
      const data = (await response.json()) as { access: string }
      tokenStore.set(data.access)
      return data.access
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function request<T>(path: string, options: RequestOptions = {}, retried = false): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set(
    'Accept',
    options.responseType === 'json' || !options.responseType ? 'application/json' : '*/*',
  )
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (options.body !== undefined && !isFormData) headers.set('Content-Type', 'application/json')
  const token = tokenStore.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey)

  let response: Response
  try {
    response = await transport(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: isFormData
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      // cookie faqat auth endpointlariga kerak (refresh/logout)
      credentials: path.startsWith('/auth/') ? 'include' : 'same-origin',
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(0, 'network_error', localizeErrorCode('network_error'))
  }

  if (response.status === 401 && !retried && !NO_REFRESH_PATHS.includes(path)) {
    const fresh = await refreshAccess()
    if (fresh) return request<T>(path, options, true)
    tokenStore.clear()
    tokenStore.notifyUnauthorized()
  }

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as T
  if (options.responseType === 'blob') return (await response.blob()) as T
  if (options.responseType === 'auto') {
    const isJson = (response.headers.get('Content-Type') ?? '').includes('application/json')
    return (
      isJson
        ? { kind: 'json', data: await response.json() }
        : {
            kind: 'file',
            file: { blob: await response.blob(), filename: filenameFrom(response, 'hisobot') },
          }
    ) as T
  }
  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string, query?: QueryParams, options?: Omit<RequestOptions, 'query' | 'method'>) =>
    request<T>(path, { ...options, query, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(path, { ...options, body, method: 'POST' }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(path, { ...options, body, method: 'PUT' }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body' | 'method'>) =>
    request<T>(path, { ...options, body, method: 'PATCH' }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  /** Fayl (PDF, Excel) — Authorization bilan; natija Blob. */
  blob: (path: string, query?: QueryParams) =>
    request<Blob>(path, { query, method: 'GET', responseType: 'blob' }),
  /** Fayl nomi bilan (Content-Disposition) — yuklab olish uchun. */
  file: (path: string) => request<FileOrJson<never>>(path, { method: 'GET', responseType: 'auto' }),
  /** POST → fayl yoki JSON (masalan og'ir hisobot fonda: 202). */
  postFileOrJson: <T>(path: string, body?: unknown) =>
    request<FileOrJson<T>>(path, { body, method: 'POST', responseType: 'auto' }),
}

/** Mutatsiyalar uchun Idempotency-Key (tarmoq uzilib qayta yuborilsa ikkinchi hujjat yaratilmaydi). */
export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
