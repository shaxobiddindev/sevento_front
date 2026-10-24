import { api } from '@/shared/api/client'
import type { Schemas } from '@/shared/api/types'
import { env } from '@/shared/config/env'

export type Ticket = Schemas['Ticket']
export type NoticeRequest = Schemas['NoticeRequest']

export const realtimeApi = {
  ticket: () => api.post<Ticket>('/realtime/ticket/'),
  notice: (body: NoticeRequest) => api.post<void>('/realtime/notice/', body),
}

/** ws(s)://host/ws/v1/ — VITE_WS_URL bo'lmasa joriy sayt orqali (Vite proxy / Nginx). */
export function websocketUrl(): string {
  if (env.wsUrl) return `${env.wsUrl.replace(/^http/, 'ws')}/ws/v1/`
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${protocol}://${window.location.host}/ws/v1/`
}
