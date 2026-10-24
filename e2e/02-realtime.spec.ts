/**
 * 2-bosqich: WebSocket — rahbar xabari sotuvchida darhol, rol o'zgarsa sessiya yangilanadi
 * (session.revoked), foydalanuvchi o'chirilsa tizimdan chiqariladi; ticket URL da emas.
 */
import { test } from '@playwright/test'

import {
  ADMIN_USER,
  BASE,
  PASSWORD,
  adminPassword,
  adminToken,
  check,
  createBranch,
  createUser,
  login,
  newContext,
  refs,
  uniq,
} from './helpers'

test('jonli xabarlar va sessiyani bekor qilish', async ({ browser }) => {
  const sfx = uniq()
  const admin = await adminToken()
  const ref = await refs(admin)
  const branch = await createBranch(admin, `RT${sfx}`, `Realtime ${sfx}`)
  const seller = await createUser(admin, `rtsotuv${sfx}`, ref.role('seller'), [branch.id])

  const adminCtx = await newContext(browser)
  const sellerCtx = await newContext(browser)
  const frames: string[] = []
  const errors: string[] = []
  const owner = await login(adminCtx, ADMIN_USER, adminPassword(), errors)
  const sellerPage = await sellerCtx.newPage()
  sellerPage.on('websocket', (ws) => ws.on('framesent', (f) => frames.push(String(f.payload))))
  sellerPage.on('pageerror', (e) => errors.push(e.message))
  await sellerPage.goto(`${BASE}/login`)
  await sellerPage.fill('#username', seller.username)
  await sellerPage.fill('#password', PASSWORD)
  await sellerPage.click('button[type=submit]')
  await sellerPage.waitForSelector('[data-status="online"]')
  check('ikkala oynada WebSocket «Jonli»', true)

  // rahbar hammaga xabar yuboradi
  const text = `Soat 18:00 da inventarizatsiya ${sfx}`
  await owner.goto(`${BASE}/settings/system`)
  await owner.selectOption('select[name=level]', 'warning')
  await owner.fill('input[name=message]', text)
  await owner.click('button:has-text("Yuborish")')
  await sellerPage.waitForSelector(`text=${text}`, { timeout: 5000 })
  check("system.notice sotuvchida darhol ko'rindi", true)

  // rol o'zgardi → sotuvchida huquqlar qayta o'qiladi, qayta ulanadi
  await owner.goto(`${BASE}/settings/users/${seller.id}`)
  await owner.selectOption('select[name=role]', { label: 'Omborchi' })
  await owner.click('button[type=submit]:has-text("Saqlash")')
  await owner.waitForSelector('text=Foydalanuvchi saqlandi')
  await sellerPage.waitForSelector("text=Huquqlaringiz o'zgardi", { timeout: 5000 })
  await sellerPage.waitForSelector('[data-status="online"]')
  check(
    "session.revoked → me qayta o'qildi, menyu yangilandi",
    (await sellerPage.locator('a[href="/sales/pos"]').count()) === 0,
  )

  // foydalanuvchi o'chirildi → tizimdan chiqariladi
  await owner.click('button[role=switch]')
  await owner.click('button[type=submit]:has-text("Saqlash")')
  await owner.waitForSelector('text=Foydalanuvchi saqlandi')
  await sellerPage.waitForURL(/\/login/, { timeout: 10_000 })
  check('user.deactivated → sotuvchi tizimdan chiqarildi', true)

  const auth = frames.find((f) => f.includes('"auth"'))
  check("ticket birinchi xabarda (URL da yo'q)", !!auth && !sellerPage.url().includes('ticket'))
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  await adminCtx.close()
  await sellerCtx.close()
})
