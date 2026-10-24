/**
 * 4-bosqich: yetkazib beruvchi → kirim (USD, UZS xarajat, birlik aniqligi) → tannarx oldindan hisobi →
 * qabul → sotuvchida qoldiq jonli (stock.changed, tannarxsiz) → tovar kartasi → minimal qoldiq →
 * bekor qilish → «Kam qoldi» toast → harakatlar jurnali; sotuvchi kirimga kira olmaydi.
 */
import { test } from '@playwright/test'

import {
  BASE,
  PASSWORD,
  adminToken,
  check,
  createBranch,
  createUser,
  digits,
  login,
  newContext,
  norm,
  ok,
  refs,
  uniq,
  type Json,
} from './helpers'

test('kirim, tannarx va jonli qoldiq', async ({ browser }) => {
  const sfx = uniq()
  const tok = await adminToken()
  const ref = await refs(tok)
  const branch = await createBranch(tok, `E${sfx}`, `E2E do'kon ${sfx}`)
  const keeper = await createUser(tok, `omb${sfx}`, ref.role('storekeeper'), [branch.id])
  const seller = await createUser(tok, `sot${sfx}`, ref.role('seller'), [branch.id])
  const cola = await ok(tok, 'POST', '/catalog/products/', {
    sku: `cola-${sfx}`,
    name: `Cola 1L ${sfx}`,
    unit: ref.unit('dona'),
  })
  const sugar = await ok(tok, 'POST', '/catalog/products/', {
    sku: `shakar-${sfx}`,
    name: `Shakar ${sfx}`,
    unit: ref.unit('kg'),
  })
  const latest: Json[] = await ok(tok, 'GET', '/currency-rates/latest/')
  const rate = Number(latest.find((r) => r.code === 'USD')?.rate)

  const errors: string[] = []
  const ombCtx = await newContext(browser)
  const sotCtx = await newContext(browser)
  const omb = await login(ombCtx, keeper.username, PASSWORD, errors)
  const frames: { type: string; payload: Record<string, unknown> }[] = []
  sotCtx.on('page', (p) =>
    p.on('websocket', (ws) =>
      ws.on('framereceived', (f) => {
        try {
          const msg = JSON.parse(String(f.payload))
          if (msg.type) frames.push(msg)
        } catch {
          /* ping/pong */
        }
      }),
    ),
  )
  const sot = await login(sotCtx, seller.username, PASSWORD, errors)

  check(
    "sotuvchi menyusida «Kirimlar» yo'q, «Qoldiq» bor",
    (await sot.locator('a[href="/purchasing/purchases"]').count()) === 0 &&
      (await sot.locator('a[href="/inventory/stock"]').count()) === 1,
  )
  await sot.click('a[href="/inventory/stock"]')
  await sot.waitForSelector("text=Qoldiq yo'q")
  check(
    "sotuvchi: «Qiymat» ustuni yo'q",
    (await sot.locator('th:has-text("Qiymat")').count()) === 0,
  )

  // yetkazib beruvchi va kirim qoralamasi
  await omb.click('a[href="/purchasing/suppliers"]')
  await omb.click('button:has-text("Yangi yetkazib beruvchi")')
  await omb.fill('#supplier-form input[name=name]', `Coca-Cola Bottlers ${sfx}`)
  await omb.fill('#supplier-form input[name=phone]', '+998 71 200 00 00')
  await omb.click('button[form=supplier-form]')
  await omb.waitForSelector('text=Yetkazib beruvchi saqlandi')

  await omb.click('a[href="/purchasing/purchases"]')
  await omb.click('button:has-text("Yangi kirim")')
  await omb.waitForURL(/\/purchasing\/purchases\/new$/)
  await omb.selectOption('select[name=supplier]', { label: `Coca-Cola Bottlers ${sfx}` })
  await omb.selectOption('select[name=currency]', { label: 'USD' })
  const pick = async (index: number, text: string) => {
    await omb.locator('input[role=combobox]').nth(index).fill(text)
    await omb.locator('[role=option]', { hasText: text }).first().click()
  }
  await pick(0, `Cola 1L ${sfx}`)
  await omb.fill('input[name="items.0.quantity"]', '1,5')
  await omb.fill('input[name="items.0.unit_price"]', '0,8')
  await omb.click('button[type=submit]:has-text("Saqlash")')
  await omb.waitForSelector("text=Ko'pi bilan 0 xona kasr")
  check('dona uchun kasr miqdor rad etildi', omb.url().endsWith('/new'))
  await omb.fill('input[name="items.0.quantity"]', '100')
  await omb.click('button:has-text("Qator qo\'shish")')
  await pick(1, `Shakar ${sfx}`)
  await omb.fill('input[name="items.1.quantity"]', '25,5')
  await omb.fill('input[name="items.1.unit_price"]', '0,45')
  const subtotal = norm(await omb.locator('[data-testid=purchase-subtotal]').textContent())
  check('qatorlar summasi 91,48 USD atrofida', /91,4[78]\s?USD/.test(subtotal), subtotal)
  await omb.click('button:has-text("Xarajat qo\'shish")')
  await omb.selectOption('select[name="expenses.0.expense_type"]', { label: 'Transport' })
  await omb.selectOption('select[name="expenses.0.currency"]', { label: 'UZS' })
  await omb.fill('input[name="expenses.0.amount"]', '250000')
  await omb.click('button[type=submit]:has-text("Saqlash")')
  await omb.waitForSelector('text=Kirim qoralamasi saqlandi')
  await omb.waitForURL(/\/purchasing\/purchases\/\d+$/)
  const purchaseId = Number(omb.url().split('/').pop())
  const total = await omb.locator('[data-testid=cost-total]').textContent()
  const expected = 91.475 + 250000 / rate // qatorlar + transport (so'm → USD joriy kurs bilan)
  check(
    `tannarx (server): jami ≈ ${expected.toFixed(2)} USD`,
    Math.abs(digits(total) - expected) < 0.02,
    total,
  )

  // qabul → sotuvchida qoldiq jonli
  const searched = sot.waitForResponse(
    (r) => r.url().includes('/api/v1/inventory/stock/') && r.url().includes(`search=${sfx}`),
  )
  await sot.fill('input[placeholder="Nomi, artikul yoki shtrix-kod"]', sfx)
  await searched
  await sot.waitForSelector("text=Qoldiq yo'q")
  await omb.click('button:has-text("Qabul qilish")')
  await omb.locator('[role=dialog] button:has-text("Qabul qilish")').click()
  await omb.waitForSelector('text=Kirim qabul qilindi')
  const qtyCell = sot.locator(`[data-testid="qty-${cola.id}-${branch.id}"]`)
  await qtyCell.waitFor({ timeout: 10_000 })
  check("sotuvchida qoldiq jonli paydo bo'ldi", norm(await qtyCell.textContent()) === '100 dona')
  check(
    'shakar: 25,5 kg',
    norm(await sot.locator(`[data-testid="qty-${sugar.id}-${branch.id}"]`).textContent()) ===
      '25,500 kg',
  )
  const changed = frames.filter((m) => m.type === 'stock.changed')
  check(
    'sotuvchiga 2 ta stock.changed (tannarxsiz)',
    changed.length === 2 &&
      changed.every((m) => m.payload.branch_id === branch.id && !('unit_cost_base' in m.payload)),
  )

  // tovar kartasi
  const detail = await ok(tok, 'GET', `/purchasing/purchases/${purchaseId}/`)
  await omb.goto(`${BASE}/inventory/products/${cola.id}`)
  await omb.waitForSelector(`a:has-text("${detail.number}")`)
  const batch = norm(
    await omb
      .locator('section', { hasText: 'Ochiq partiyalar' })
      .locator('tbody tr')
      .first()
      .textContent(),
  )
  check(`tovar kartasi: partiya ${detail.number}`, batch.includes(detail.number), batch)

  // minimal qoldiq va bekor qilish → «Kam qoldi»
  await omb.goto(`${BASE}/inventory/stock`)
  await omb.fill('input[placeholder="Nomi, artikul yoki shtrix-kod"]', `Cola 1L ${sfx}`)
  const row = omb.locator('tr', { hasText: `Cola 1L ${sfx}` })
  await row.waitFor()
  await row.locator('button[aria-label="Minimal qoldiq"]').click()
  await omb.locator('[role=dialog] input').fill('60')
  await omb.locator('[role=dialog] button:has-text("Saqlash")').click()
  await omb.waitForSelector('text=Minimal qoldiq saqlandi')

  await omb.goto(`${BASE}/purchasing/purchases/${purchaseId}`)
  await omb.click('button:has-text("Bekor qilish")')
  await omb.locator('[role=dialog] input').fill('Xato kiritilgan (e2e)')
  await omb.locator('[role=dialog] button:has-text("Bekor qilish")').click()
  await omb.waitForSelector('text=Kirim bekor qilindi')
  await sot.waitForSelector(`text=Kam qoldi: Cola 1L ${sfx}`, { timeout: 10_000 })
  await sot.waitForFunction(
    (sel) => (document.querySelector(sel)?.textContent ?? '').replace(/\s/g, ' ').startsWith('0 '),
    `[data-testid="qty-${cola.id}-${branch.id}"]`,
  )
  check('bekor qilish: sotuvchida «Kam qoldi» toast va qoldiq 0', true)

  await omb.goto(`${BASE}/inventory/movements?type=purchase_cancel`)
  await omb.waitForSelector(`td >> text=Cola 1L ${sfx}`)
  await sot.goto(`${BASE}/purchasing/purchases/new`)
  await sot.waitForSelector("text=Ruxsat yo'q")
  check('harakatlar jurnali; sotuvchi kirimga kira olmaydi (403)', true)
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  await ombCtx.close()
  await sotCtx.close()
})
