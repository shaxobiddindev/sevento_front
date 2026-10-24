/** E2E yordamchilari: REST (tayyor ma'lumot yaratish uchun), kirish, toast, tekshiruv. */
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

export const BASE = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173').replace(/\/+$/, '')
export const API = `${BASE}/api/v1`
export const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin'

/** Rahbar paroli faqat muhitdan (kodda parol yo'q). */
export function adminPassword(): string {
  const value = process.env.E2E_ADMIN_PASSWORD
  if (!value)
    throw new Error("E2E_ADMIN_PASSWORD muhit o'zgaruvchisi kerak (bootstrap rahbar paroli)")
  return value
}

/** Har ishga tushirishga yangi parol — test foydalanuvchilari uchun. */
export const PASSWORD = `E2e-${Math.random().toString(36).slice(2, 10)}-${Date.now() % 1000}`

/** Har test uchun noyob qo'shimcha (kod, SKU, nomlar). */
export const uniq = () => Date.now().toString().slice(-5)

// API javoblari testda erkin shaklda o'qiladi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any

export async function api(
  token: string | null,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; data: Json }> {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

export async function ok(token: string | null, method: string, url: string, body?: unknown) {
  const r = await api(token, method, url, body)
  if (r.status >= 300) throw new Error(`${method} ${url} → ${r.status} ${JSON.stringify(r.data)}`)
  return r.data as Json
}

export const list = (d: Json): Json[] => (Array.isArray(d) ? d : d.results)

export async function token(username: string, password: string): Promise<string> {
  return (await ok(null, 'POST', '/auth/login/', { username, password })).access
}

export const adminToken = () => token(ADMIN_USER, adminPassword())

/** Matnni solishtirish uchun: bo'linmas bo'sh joylar → oddiy, ortiqcha bo'sh joysiz. */
export const norm = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** "12 650,45 USD" → 12650.45 */
export const digits = (s: string | null | undefined) =>
  Number(
    norm(s)
      .replace(/[^\d,-]/g, '')
      .replace(',', '.'),
  )

/** Soft tekshiruv: bitta xato qolgan qadamlarni to'xtatmaydi, hisobotda nomi bilan chiqadi. */
export function check(name: string, condition: boolean, extra: unknown = '') {
  expect
    .soft(condition, `${name} ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`)
    .toBe(true)
}

export function newContext(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  return browser.newContext({
    viewport: { width: 1366, height: 900 },
    timezoneId: 'Asia/Tashkent',
    ...options,
  })
}

/** Kirish: login sahifasi → dashboard, WebSocket «Jonli». Sahifa JS xatolari `errors` ga yig'iladi. */
export async function login(
  context: BrowserContext,
  username: string,
  password: string,
  errors?: string[],
): Promise<Page> {
  const page = await context.newPage()
  if (errors) page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/login`)
  await page.fill('#username', username)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  await page.waitForSelector('[data-status="online"]', { timeout: 15_000 })
  return page
}

export async function waitToast(page: Page, text: string | RegExp, timeout = 10_000) {
  await page.locator('[role=status]', { hasText: text }).first().waitFor({ timeout })
}

/** Matn shartga mos kelguncha kutadi (jonli yangilanishlar uchun). */
export async function waitText(
  page: Page,
  selector: string,
  predicate: (text: string) => boolean,
  timeout = 10_000,
): Promise<string> {
  const until = Date.now() + timeout
  let last = ''
  while (Date.now() < until) {
    last = norm(
      await page
        .locator(selector)
        .first()
        .textContent()
        .catch(() => ''),
    )
    if (predicate(last)) return last
    await page.waitForTimeout(150)
  }
  return last
}

/** Qatorli hujjat formasida tovar tanlash (kirim, ko'chirish, hisobdan chiqarish). */
export async function pickProduct(page: Page, index: number, query: string, label: string) {
  const box = page.locator('[data-testid=doc-line] input[role=combobox]').nth(index)
  await box.fill(query)
  await page.locator('[role=option]', { hasText: label }).first().click()
}

/** Nuqtadagi tovar qoldig'i (REST). */
export async function stockQty(tok: string, branchId: number, productId: number): Promise<number> {
  const rows = list(
    await ok(tok, 'GET', `/inventory/stock/?branch=${branchId}&product=${productId}`),
  )
  return rows.length ? Number(rows[0].quantity) : 0
}

/** Ma'lumotnomalar (birlik, valyuta, narx turi, rol, to'lov turi) — kod bo'yicha id. */
export async function refs(tok: string) {
  const [units, currencies, priceTypes, roles, methods] = await Promise.all([
    ok(tok, 'GET', '/catalog/units/'),
    ok(tok, 'GET', '/currencies/'),
    ok(tok, 'GET', '/catalog/price-types/'),
    ok(tok, 'GET', '/roles/'),
    ok(tok, 'GET', '/payments/methods/'),
  ])
  const by = (rows: Json, code: string) =>
    list(rows).find((r: Json) => r.code === code).id as number
  return {
    unit: (code: string) => by(units, code),
    currency: (code: string) => by(currencies, code),
    retail: list(priceTypes).find((p: Json) => p.is_default).id as number,
    role: (code: string) => by(roles, code),
    method: (code: string) => by(methods, code),
  }
}

/** Test nuqtasi va unga biriktirilgan foydalanuvchi. */
export async function createBranch(tok: string, code: string, name: string, type = 'shop') {
  return ok(tok, 'POST', '/branches/', { code, name, type })
}

export async function createUser(
  tok: string,
  username: string,
  roleId: number,
  branchIds: number[],
  fullName = username,
) {
  return ok(tok, 'POST', '/users/', {
    username,
    password: PASSWORD,
    full_name: fullName,
    role: roleId,
    branch_ids: branchIds,
    default_branch_id: branchIds[0],
  })
}
