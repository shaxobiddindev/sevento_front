import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveFile } from '@/shared/lib/download'

import { desktopTransport, installDesktop } from './desktop'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }))

const invokeMock = vi.mocked(invoke)
const fetchMock = vi.mocked(tauriFetch)

describe('desktop (Tauri) moslamalari', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    fetchMock.mockReset()
  })

  it("auth so'rovlari Rust buyrug'i orqali (refresh cookie JS ga kelmaydi)", async () => {
    invokeMock.mockResolvedValue({
      status: 200,
      headers: [['content-type', 'application/json']],
      body: '{"access":"tok"}',
    })
    const response = await desktopTransport('https://s.uz/api/v1/auth/refresh/', {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    expect(invokeMock).toHaveBeenCalledWith('auth_request', {
      url: 'https://s.uz/api/v1/auth/refresh/',
      method: 'POST',
      headers: [['accept', 'application/json']],
      body: null,
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ access: 'tok' })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it("logout 204 — bo'sh javob", async () => {
    invokeMock.mockResolvedValue({ status: 204, headers: [], body: '' })
    const response = await desktopTransport('https://s.uz/api/v1/auth/logout/', { method: 'POST' })
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  it("boshqa so'rovlar plugin-http orqali", async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }))
    const init = { method: 'GET', headers: { Authorization: 'Bearer t' } }
    await desktopTransport('https://s.uz/api/v1/sales/?page=2', init)
    expect(fetchMock).toHaveBeenCalledWith('https://s.uz/api/v1/sales/?page=2', init)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('fayl saqlash oynasi: tanlansa true, bekor qilinsa false', async () => {
    installDesktop()
    invokeMock.mockResolvedValueOnce('/home/u/hisobot.xlsx').mockResolvedValueOnce(null)
    const blob = new Blob(['abc'])
    expect(await saveFile(blob, 'sotuv hisoboti.xlsx')).toBe(true)
    expect(invokeMock).toHaveBeenLastCalledWith('save_document', expect.any(Uint8Array), {
      headers: { 'x-file-name': 'sotuv%20hisoboti.xlsx' },
    })
    expect(await saveFile(blob, 'x.pdf')).toBe(false)
  })
})
