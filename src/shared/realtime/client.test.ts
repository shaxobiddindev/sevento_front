import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RealtimeClient, type RealtimeMessage } from './client'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static OPEN = 1
  readyState = 0
  sent: string[] = []
  closedWith: number | null = null
  onopen: ((ev: Event) => void) | null = null
  onmessage: ((ev: MessageEvent) => void) | null = null
  onclose: ((ev: CloseEvent) => void) | null = null
  onerror: ((ev: Event) => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000, reason = '') {
    if (this.readyState === 3) return
    this.closedWith = code
    this.readyState = 3
    this.onclose?.({ code, reason } as CloseEvent)
  }

  // --- test yordamchilari (server tomoni) ---
  serverOpen() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  serverSend(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) } as MessageEvent)
  }
  serverClose(code: number) {
    this.readyState = 3
    this.onclose?.({ code, reason: '' } as CloseEvent)
  }
  authMessages() {
    return this.sent.map((s) => JSON.parse(s) as { type: string; payload: { ticket?: string } })
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

describe('RealtimeClient', () => {
  let tickets: number
  let statuses: string[]
  let messages: RealtimeMessage[]
  let client: RealtimeClient

  const make = (overrides: Partial<ConstructorParameters<typeof RealtimeClient>[0]> = {}) =>
    new RealtimeClient({
      url: 'ws://test/ws/v1/',
      getTicket: async () => `t${++tickets}`,
      onMessage: (m) => messages.push(m),
      onStatus: (s) => statuses.push(s),
      WebSocketImpl: FakeWebSocket as unknown as typeof WebSocket,
      pingIntervalMs: 1000,
      baseBackoffMs: 100,
      maxBackoffMs: 1000,
      random: () => 0,
      ...overrides,
    })

  const last = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]

  async function connectAndAuth() {
    client.connect()
    await flush()
    const ws = last()
    ws.serverOpen()
    ws.serverSend({ type: 'auth.ok', payload: {}, timestamp: 't' })
    return ws
  }

  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    tickets = 0
    statuses = []
    messages = []
    client = make()
  })

  afterEach(() => {
    client.close()
    vi.useRealTimers()
  })

  it('ticket oladi, auth yuboradi, auth.ok dan keyin online', async () => {
    const ws = await connectAndAuth()
    expect(ws.authMessages()[0]).toEqual({ type: 'auth', payload: { ticket: 't1' } })
    expect(statuses).toEqual(['connecting', 'online'])
    expect(client.getStatus()).toBe('online')
  })

  it('xabarlarni onMessage ga uzatadi, pong ni uzatmaydi', async () => {
    const ws = await connectAndAuth()
    ws.serverSend({ type: 'stock.changed', payload: { branch_id: 1 }, timestamp: 't' })
    ws.serverSend({ type: 'pong', payload: {}, timestamp: 't' })
    ws.serverSend('buzuq')
    expect(messages).toHaveLength(1)
    expect(messages[0].type).toBe('stock.changed')
  })

  it('bir xil id li xabar (ikki guruh orqali) bir marta uzatiladi; id siz — har safar', async () => {
    const ws = await connectAndAuth()
    const sent = { id: 'abc', type: 'transfer.sent', payload: { transfer_id: 1 }, timestamp: 't' }
    ws.serverSend(sent)
    ws.serverSend(sent)
    ws.serverSend({ ...sent, id: 'def' })
    ws.serverSend({ type: 'stock.changed', payload: {}, timestamp: 't' })
    ws.serverSend({ type: 'stock.changed', payload: {}, timestamp: 't' })
    expect(messages.map((m) => m.id ?? m.type)).toEqual([
      'abc',
      'def',
      'stock.changed',
      'stock.changed',
    ])
  })

  it('uzilganda backoff bilan yangi ticket olib qayta ulanadi', async () => {
    const ws = await connectAndAuth()
    ws.serverClose(1006)
    expect(client.getStatus()).toBe('offline')
    expect(FakeWebSocket.instances).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(100) // 100 * 2^0 + 0 jitter
    expect(FakeWebSocket.instances).toHaveLength(2)
    const ws2 = last()
    ws2.serverOpen()
    expect(ws2.authMessages()[0].payload.ticket).toBe('t2')
    ws2.serverSend({ type: 'auth.ok', payload: {}, timestamp: 't' })
    expect(client.getStatus()).toBe('online')

    // ikkinchi uzilish — backoff oshadi (200), lekin auth.ok dan keyin nolga qaytgan edi → yana 100
    ws2.serverClose(1006)
    await vi.advanceTimersByTimeAsync(99)
    expect(FakeWebSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(3)
  })

  it("ketma-ket muvaffaqiyatsiz urinishlarda backoff eksponensial o'sadi va chegaralanadi", async () => {
    client.connect()
    await flush()
    last().serverClose(1006) // 1-urinish: 100
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeWebSocket.instances).toHaveLength(2)
    last().serverClose(1006) // 2-urinish: 200
    await vi.advanceTimersByTimeAsync(199)
    expect(FakeWebSocket.instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(FakeWebSocket.instances).toHaveLength(3)
    for (let i = 0; i < 6; i++) {
      last().serverClose(1006)
      await vi.advanceTimersByTimeAsync(1000) // max 1000 dan oshmaydi
    }
    expect(FakeWebSocket.instances).toHaveLength(9)
  })

  it('4401 da kutmasdan yangi ticket bilan qayta ulanadi', async () => {
    const ws = await connectAndAuth()
    ws.serverSend({ type: 'auth.error', payload: { code: 'invalid_ticket' }, timestamp: 't' })
    ws.serverClose(4401)
    await flush()
    expect(FakeWebSocket.instances).toHaveLength(2)
    expect(last().url).toBe('ws://test/ws/v1/')
  })

  it('ping yuboradi; 2 ta pong kelmasa ulanishni yopib qayta ochadi', async () => {
    const ws = await connectAndAuth()
    await vi.advanceTimersByTimeAsync(1000)
    expect(ws.sent.filter((s) => s.includes('"ping"'))).toHaveLength(1)
    ws.serverSend({ type: 'pong', payload: {}, timestamp: 't' })
    await vi.advanceTimersByTimeAsync(1000) // 2-ping, pong yo'q
    await vi.advanceTimersByTimeAsync(1000) // missed 1 → 3-ping
    await vi.advanceTimersByTimeAsync(1000) // missed 2 → close
    expect(ws.closedWith).not.toBeNull()
    expect(client.getStatus()).toBe('offline')
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('close() 1000 bilan yopadi va qayta ulanmaydi', async () => {
    const ws = await connectAndAuth()
    client.close()
    expect(ws.closedWith).toBe(1000)
    expect(client.getStatus()).toBe('idle')
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it("ticket olib bo'lmasa offline bo'lib keyinroq urinadi", async () => {
    let fail = true
    client = make({
      getTicket: async () => {
        if (fail) throw new Error('network')
        return 'ok'
      },
    })
    client.connect()
    await flush()
    expect(client.getStatus()).toBe('offline')
    expect(FakeWebSocket.instances).toHaveLength(0)
    fail = false
    await vi.advanceTimersByTimeAsync(100)
    expect(FakeWebSocket.instances).toHaveLength(1)
  })

  it('onClose kodni uzatadi (provider 4403 ni hal qiladi)', async () => {
    const closes: number[] = []
    client = make({ onClose: (code) => closes.push(code) })
    const ws = await connectAndAuth()
    ws.serverSend({ type: 'session.revoked', payload: { reason: 'deactivated' }, timestamp: 't' })
    ws.serverClose(4403)
    expect(messages[0].type).toBe('session.revoked')
    expect(closes).toEqual([4403])
  })
})
