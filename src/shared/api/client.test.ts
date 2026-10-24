import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { server } from '@/test/msw'

import { api, newIdempotencyKey, refreshAccess } from './client'
import { ApiError } from './errors'
import { tokenStore } from './tokenStore'

const BASE = '/api/v1'

function errorBody(code: string, message = code, details: unknown[] = []) {
  return { error: { code, message, details, request_id: 'r1' } }
}

describe('api client', () => {
  beforeEach(() => tokenStore.clear())

  it('Bearer token va query parametrlarini yuboradi', async () => {
    tokenStore.set('tok')
    let seen: { auth: string | null; url: string } | null = null
    server.use(
      http.get(`${BASE}/users/`, ({ request }) => {
        seen = { auth: request.headers.get('Authorization'), url: request.url }
        return HttpResponse.json({ count: 0, results: [] })
      }),
    )
    await api.get(`/users/`, { page: 2, search: 'ali', empty: '', skip: undefined })
    expect(seen!.auth).toBe('Bearer tok')
    expect(new URL(seen!.url).search).toBe('?page=2&search=ali')
  })

  it('xato formatini ApiError ga aylantiradi', async () => {
    server.use(
      http.post(`${BASE}/branches/`, () =>
        HttpResponse.json(
          errorBody('validation_error', 'Xato', [
            { field: 'code', code: 'unique', message: 'Band' },
          ]),
          { status: 400 },
        ),
      ),
    )
    const error = await api.post('/branches/', {}).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(400)
    expect(apiError.isValidation).toBe(true)
    expect(apiError.fieldErrors()).toEqual({ code: 'Band' })
    expect(apiError.requestId).toBe('r1')
    expect(apiError.message).toBe("Ma'lumotlar noto'g'ri to'ldirilgan")
  })

  it("401 da refresh qilib so'rovni takrorlaydi", async () => {
    tokenStore.set('old')
    const calls: string[] = []
    server.use(
      http.get(`${BASE}/auth/me/`, ({ request }) => {
        const auth = request.headers.get('Authorization')
        calls.push(auth ?? '')
        if (auth === 'Bearer old') {
          return HttpResponse.json(errorBody('token_not_valid'), { status: 401 })
        }
        return HttpResponse.json({ id: 1 })
      }),
      http.post(`${BASE}/auth/refresh/`, () => HttpResponse.json({ access: 'new' })),
    )
    const me = await api.get<{ id: number }>('/auth/me/')
    expect(me).toEqual({ id: 1 })
    expect(calls).toEqual(['Bearer old', 'Bearer new'])
    expect(tokenStore.get()).toBe('new')
  })

  it('refresh ham 401 bersa tokenni tozalab, sessiya tugaganini bildiradi', async () => {
    tokenStore.set('old')
    const onUnauthorized = vi.fn()
    const off = tokenStore.onUnauthorized(onUnauthorized)
    server.use(
      http.get(`${BASE}/users/`, () =>
        HttpResponse.json(errorBody('token_not_valid'), { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh/`, () =>
        HttpResponse.json(errorBody('token_not_valid'), { status: 401 }),
      ),
    )
    const error = await api.get('/users/').catch((e: unknown) => e as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(tokenStore.get()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    off()
  })

  it('parallel 401 lar bitta refresh ni kutadi', async () => {
    tokenStore.set('old')
    let refreshCount = 0
    server.use(
      http.get(`${BASE}/users/`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer old'
          ? HttpResponse.json(errorBody('token_not_valid'), { status: 401 })
          : HttpResponse.json({ ok: true }),
      ),
      http.post(`${BASE}/auth/refresh/`, async () => {
        refreshCount += 1
        await new Promise((r) => setTimeout(r, 20))
        return HttpResponse.json({ access: 'new' })
      }),
    )
    await Promise.all([api.get('/users/'), api.get('/users/'), api.get('/users/')])
    expect(refreshCount).toBe(1)
  })

  it("refreshAccess cookie bo'lmasa null qaytaradi", async () => {
    server.use(
      http.post(`${BASE}/auth/refresh/`, () =>
        HttpResponse.json(errorBody('token_not_valid'), { status: 401 }),
      ),
    )
    expect(await refreshAccess()).toBeNull()
    expect(tokenStore.get()).toBeNull()
  })

  it('tarmoq uzilsa refresh chiqarib yubormaydi: network_error, token saqlanadi', async () => {
    tokenStore.set('old')
    const onUnauthorized = vi.fn()
    const off = tokenStore.onUnauthorized(onUnauthorized)
    server.use(
      http.get(`${BASE}/users/`, () =>
        HttpResponse.json(errorBody('token_not_valid'), { status: 401 }),
      ),
      http.post(`${BASE}/auth/refresh/`, () => HttpResponse.error()),
    )
    const error = await api.get('/users/').catch((e: unknown) => e as ApiError)
    expect((error as ApiError).code).toBe('network_error')
    expect(tokenStore.get()).toBe('old')
    expect(onUnauthorized).not.toHaveBeenCalled()
    off()
  })

  it('server ishlamasa (502) refresh xato tashlaydi, sessiya «tugadi» deb hisoblanmaydi', async () => {
    server.use(http.post(`${BASE}/auth/refresh/`, () => new HttpResponse(null, { status: 502 })))
    const error = await refreshAccess().catch((e: unknown) => e as ApiError)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('server_error')
  })

  it('204 javobda undefined qaytaradi va Idempotency-Key yuboradi', async () => {
    let key: string | null = null
    server.use(
      http.post(`${BASE}/auth/logout/`, ({ request }) => {
        key = request.headers.get('Idempotency-Key')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const idem = newIdempotencyKey()
    const result = await api.post('/auth/logout/', undefined, { idempotencyKey: idem })
    expect(result).toBeUndefined()
    expect(key).toBe(idem)
  })

  it('tarmoq xatosi → network_error', async () => {
    server.use(http.get(`${BASE}/health/`, () => HttpResponse.error()))
    const error = await api.get('/health/').catch((e: unknown) => e as ApiError)
    expect((error as ApiError).code).toBe('network_error')
  })
})
