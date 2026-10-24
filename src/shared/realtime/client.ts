/**
 * WebSocket mijozi (docs/realtime.md):
 *  - REST dan bir martalik ticket → ulanish → birinchi xabar {type:"auth"} → auth.ok
 *  - ping/pong (25 s); 2 ta pong kelmasa qayta ulanadi
 *  - uzilganda eksponensial backoff (1s → 30s) + jitter; har urinishda yangi ticket
 *  - brauzer `online` va tab ko'ringanda darhol qayta ulanish
 * Faqat bildirishnoma kanali: xabar kelganda TanStack Query keshi invalidate qilinadi.
 *  - bir xabar bir nechta guruh orqali kelsa (ko'chirish — ikkala nuqtaga) `id` bo'yicha bir marta
 */

export interface RealtimeMessage {
  /** Server konverti id si — takroriy yetkazishni aniqlash uchun (eski serverda bo'lmasligi mumkin) */
  id?: string
  type: string
  payload: Record<string, unknown>
  timestamp: string
}

/** Oxirgi shuncha xabar id si eslab qolinadi (takrorlar odatda millisekundlar ichida keladi). */
const SEEN_LIMIT = 200

export type ClientStatus = 'idle' | 'connecting' | 'online' | 'offline'

export const CLOSE_CODES = {
  NORMAL: 1000,
  UNAUTHORIZED: 4401,
  FORBIDDEN: 4403,
  AUTH_TIMEOUT: 4408,
  TOO_MANY: 4429,
} as const

export interface RealtimeClientOptions {
  url: string
  getTicket: () => Promise<string>
  onMessage: (message: RealtimeMessage) => void
  onStatus?: (status: ClientStatus) => void
  onClose?: (code: number, reason: string) => void
  WebSocketImpl?: typeof WebSocket
  pingIntervalMs?: number
  baseBackoffMs?: number
  maxBackoffMs?: number
  random?: () => number
}

const OPEN = 1

export class RealtimeClient {
  private ws: WebSocket | null = null
  private active = false
  private attempt = 0
  private generation = 0
  private status: ClientStatus = 'idle'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pongPending = false
  private missedPongs = 0
  private readonly seen = new Set<string>()

  constructor(private readonly opts: RealtimeClientOptions) {}

  getStatus(): ClientStatus {
    return this.status
  }

  connect(): void {
    if (this.active) return
    this.active = true
    this.attempt = 0
    this.bindWindow()
    void this.open()
  }

  close(): void {
    this.active = false
    this.generation++
    this.unbindWindow()
    this.clearReconnect()
    this.stopPing()
    const ws = this.ws
    this.ws = null
    ws?.close(CLOSE_CODES.NORMAL)
    this.setStatus('idle')
  }

  /** Tashqi signal (tarmoq qaytdi, tab ochildi): kutmasdan qayta ulanish. */
  reconnectNow(): void {
    if (!this.active || this.ws) return
    this.clearReconnect()
    void this.open()
  }

  private setStatus(status: ClientStatus) {
    if (this.status === status) return
    this.status = status
    this.opts.onStatus?.(status)
  }

  private async open(): Promise<void> {
    if (!this.active) return
    this.setStatus('connecting')
    const generation = ++this.generation
    let ticket: string
    try {
      ticket = await this.opts.getTicket()
    } catch {
      if (generation === this.generation && this.active) {
        this.setStatus('offline')
        this.scheduleReconnect()
      }
      return
    }
    if (!this.active || generation !== this.generation) return

    const Impl = this.opts.WebSocketImpl ?? WebSocket
    const ws = new Impl(this.opts.url)
    this.ws = ws
    ws.onopen = () => {
      if (ws !== this.ws) return
      ws.send(JSON.stringify({ type: 'auth', payload: { ticket } }))
    }
    ws.onmessage = (event) => {
      if (ws !== this.ws) return
      this.handleMessage(String(event.data))
    }
    ws.onclose = (event) => {
      if (ws !== this.ws) return
      this.ws = null
      this.stopPing()
      this.opts.onClose?.(event.code, event.reason)
      if (!this.active) {
        this.setStatus('idle')
        return
      }
      this.setStatus('offline')
      this.scheduleReconnect(this.delayForClose(event.code))
    }
    ws.onerror = () => {
      /* onclose keyin keladi */
    }
  }

  private handleMessage(raw: string) {
    let message: RealtimeMessage
    try {
      message = JSON.parse(raw) as RealtimeMessage
    } catch {
      return
    }
    if (!message || typeof message.type !== 'string') return
    switch (message.type) {
      case 'auth.ok':
        this.attempt = 0
        this.setStatus('online')
        this.startPing()
        return
      case 'auth.error':
        return // server keyin 4401 bilan yopadi
      case 'pong':
        this.pongPending = false
        this.missedPongs = 0
        return
      default:
        if (message.id) {
          if (this.seen.has(message.id)) return
          this.seen.add(message.id)
          if (this.seen.size > SEEN_LIMIT) {
            this.seen.delete(this.seen.values().next().value as string)
          }
        }
        this.opts.onMessage({ ...message, payload: message.payload ?? {} })
    }
  }

  private delayForClose(code: number): number | undefined {
    switch (code) {
      case CLOSE_CODES.UNAUTHORIZED:
      case CLOSE_CODES.AUTH_TIMEOUT:
      case CLOSE_CODES.FORBIDDEN:
        return 0 // yangi ticket (va yangi guruhlar) bilan darhol
      case CLOSE_CODES.TOO_MANY:
        return 30_000
      default:
        return undefined // backoff
    }
  }

  private scheduleReconnect(fixedDelay?: number) {
    if (!this.active) return
    this.clearReconnect()
    const delay = fixedDelay ?? this.nextBackoff()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.open()
    }, delay)
  }

  private nextBackoff(): number {
    const base = this.opts.baseBackoffMs ?? 1000
    const max = this.opts.maxBackoffMs ?? 30_000
    const random = this.opts.random ?? Math.random
    const delay = Math.min(max, base * 2 ** this.attempt)
    this.attempt = Math.min(this.attempt + 1, 10)
    return delay + Math.floor(random() * 500)
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startPing() {
    this.stopPing()
    this.pongPending = false
    this.missedPongs = 0
    this.pingTimer = setInterval(() => {
      const ws = this.ws
      if (!ws || ws.readyState !== OPEN) return
      if (this.pongPending) {
        this.missedPongs++
        if (this.missedPongs >= 2) {
          ws.close() // onclose → offline → qayta ulanish
          return
        }
      }
      this.pongPending = true
      ws.send(JSON.stringify({ type: 'ping', payload: {} }))
    }, this.opts.pingIntervalMs ?? 25_000)
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.pongPending = false
    this.missedPongs = 0
  }

  private readonly onWindowOnline = () => {
    if (this.status === 'offline') this.reconnectNow()
  }

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible' && this.status === 'offline') this.reconnectNow()
  }

  private bindWindow() {
    if (typeof window === 'undefined') return
    window.addEventListener('online', this.onWindowOnline)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  private unbindWindow() {
    if (typeof window === 'undefined') return
    window.removeEventListener('online', this.onWindowOnline)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }
}
