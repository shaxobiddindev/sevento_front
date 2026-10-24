/**
 * Tauri desktop moslamalari (src-tauri/src/*.rs bilan juft):
 *  - HTTP: auth endpointlari (login/refresh/logout) — Rust `auth_request` (refresh cookie faqat
 *    Rust cookie jarida, JS ko'rmaydi); qolgan so'rovlar — plugin-http (CORS siz, ruxsat faqat
 *    build da berilgan serverga).
 *  - Fayl saqlash — tizimning saqlash oynasi (`save_document`); chek/PDF — tizim dasturida
 *    ochiladi va u yerdan chop etiladi (`open_document`). JS ga fayl tizimi ruxsati yo'q.
 */
import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { setTransport } from '@/shared/api/client'
import i18n from '@/shared/i18n'
import { setSaveHandler } from '@/shared/lib/download'
import { setOpenHandler } from '@/shared/lib/print'
import { toast } from '@/shared/ui/toast'

export const AUTH_PATHS = ['/api/v1/auth/login/', '/api/v1/auth/refresh/', '/api/v1/auth/logout/']

interface AuthResponse {
  status: number
  headers: [string, string][]
  body: string
}

const NO_BODY = new Set([204, 205, 304])

async function authFetch(url: string, init: RequestInit): Promise<Response> {
  const response = await invoke<AuthResponse>('auth_request', {
    url,
    method: init.method ?? 'POST',
    headers: [...new Headers(init.headers).entries()],
    body: typeof init.body === 'string' ? init.body : null,
  })
  return new Response(NO_BODY.has(response.status) ? null : response.body, {
    status: response.status,
    headers: response.headers,
  })
}

export function desktopTransport(input: string, init: RequestInit): Promise<Response> {
  return AUTH_PATHS.includes(new URL(input).pathname)
    ? authFetch(input, init)
    : tauriFetch(input, init)
}

async function sendFile(command: string, blob: Blob, filename: string) {
  return invoke(command, new Uint8Array(await blob.arrayBuffer()), {
    headers: { 'x-file-name': encodeURIComponent(filename) },
  })
}

export function installDesktop(): void {
  setTransport(desktopTransport)
  setSaveHandler(async (blob, filename) => {
    try {
      return (await sendFile('save_document', blob, filename)) !== null
    } catch (error) {
      toast.error(i18n.t('desktop.saveFailed'), String(error))
      return false
    }
  })
  setOpenHandler(async (blob, filename) => {
    try {
      await sendFile('open_document', blob, filename)
    } catch (error) {
      toast.error(i18n.t('desktop.openFailed'), String(error))
    }
  })
  document.documentElement.dataset.platform = 'desktop'
}
