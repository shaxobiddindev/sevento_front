import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { tokenStore } from '@/shared/api/tokenStore'
import { server } from '@/test/msw'

import { useAuthStore } from './authStore'

const BASE = '/api/v1'

describe('authStore.bootstrap', () => {
  beforeEach(() => {
    tokenStore.clear()
    useAuthStore.setState({ status: 'idle', user: null, currentBranchId: null })
  })

  it("tarmoq yo'q — «offline» (login sahifasiga yuborilmaydi)", async () => {
    server.use(http.post(`${BASE}/auth/refresh/`, () => HttpResponse.error()))
    await useAuthStore.getState().bootstrap()
    expect(useAuthStore.getState().status).toBe('offline')
  })

  it('server ishlamayapti (503) — «offline»', async () => {
    server.use(http.post(`${BASE}/auth/refresh/`, () => new HttpResponse(null, { status: 503 })))
    await useAuthStore.getState().bootstrap()
    expect(useAuthStore.getState().status).toBe('offline')
  })

  it("sessiya yo'q (401) — «anonymous»", async () => {
    server.use(
      http.post(`${BASE}/auth/refresh/`, () =>
        HttpResponse.json(
          { error: { code: 'token_not_valid', message: '', details: [] } },
          { status: 401 },
        ),
      ),
    )
    await useAuthStore.getState().bootstrap()
    expect(useAuthStore.getState().status).toBe('anonymous')
  })

  it("aloqa tiklansa (online hodisasi) sessiya o'zi tiklanadi", async () => {
    server.use(http.post(`${BASE}/auth/refresh/`, () => HttpResponse.error()))
    await useAuthStore.getState().bootstrap()
    expect(useAuthStore.getState().status).toBe('offline')
    server.use(
      http.post(`${BASE}/auth/refresh/`, () => HttpResponse.json({ access: 'tok' })),
      http.get(`${BASE}/auth/me/`, () =>
        HttpResponse.json({
          id: 1,
          username: 'admin',
          full_name: 'Rahbar',
          phone: '',
          is_superuser: true,
          role: { code: 'owner', name: 'Rahbar' },
          capabilities: [],
          branches: [],
          all_branches: true,
        }),
      ),
    )
    window.dispatchEvent(new Event('online'))
    await expect.poll(() => useAuthStore.getState().status).toBe('authenticated')
  })
})
