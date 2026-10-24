/**
 * 5-bosqich: bir nuqtada ikki kassa — skaner, savat, naqd + qaytim, ikkinchi kassada qoldiq jonli,
 * chek PDF, rahbar dashboardi jonli, aralash valyuta, kassa qoldig'i, omborda yetmasa xato qatorda,
 * bekor qilish (naqd yetmasa rad, aks holda qoldiq qaytadi), sotuvchi huquqlari.
 */
import { test, type Page } from '@playwright/test'

import {
  ADMIN_USER,
  API,
  BASE,
  PASSWORD,
  adminPassword,
  adminToken,
  check,
  createBranch,
  createUser,
  list,
  login,
  newContext,
  norm,
  ok,
  refs,
  token,
  uniq,
  type Json,
} from './helpers'

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
/** Kassadagi qoldiq matni `prefix` bilan boshlanguncha kutadi (jonli yangilanish). */
const waitStock = (page: Page, selector: string, prefix: string) =>
  page.waitForFunction(
    ({ selector, prefix }) =>
      (document.querySelector(selector)?.textContent ?? '').replace(/\s/g, ' ').startsWith(prefix),
    { selector, prefix },
  )

test('kassa (POS): ikki kassa, chek, bekor qilish', async ({ browser }) => {
  const sfx = uniq()
  const admin = await adminToken()
  const ref = await refs(admin)
  const branch = await createBranch(admin, `P${sfx}`, `Kassa do'kon ${sfx}`)
  const kassirA = await createUser(admin, `kassira${sfx}`, ref.role('seller'), [branch.id])
  const kassirB = await createUser(admin, `kassirb${sfx}`, ref.role('seller'), [branch.id])
  const barcode = `47${sfx}01`
  const cola = await ok(admin, 'POST', '/catalog/products/', {
    sku: `pcola-${sfx}`,
    name: `Pepsi 1L ${sfx}`,
    unit: ref.unit('dona'),
    barcode,
  })
  const sugar = await ok(admin, 'POST', '/catalog/products/', {
    sku: `pshakar-${sfx}`,
    name: `Shakar oʻzbek ${sfx}`,
    unit: ref.unit('kg'),
  })
  await ok(admin, 'POST', `/catalog/products/${cola.id}/set-price/`, {
    price_type: ref.retail,
    currency: ref.currency('UZS'),
    amount: '10000',
  })
  await ok(admin, 'POST', `/catalog/products/${sugar.id}/set-price/`, {
    price_type: ref.retail,
    currency: ref.currency('USD'),
    amount: '1.20',
  })
  const supplier = await ok(admin, 'POST', '/purchasing/suppliers/', { name: `Ta'minot ${sfx}` })
  const purchase = await ok(admin, 'POST', '/purchasing/purchases/', {
    branch: branch.id,
    supplier: supplier.id,
    currency: ref.currency('USD'),
    expenses: [],
    items: [
      { product: cola.id, quantity: '20', unit_price: '0.60' },
      { product: sugar.id, quantity: '5', unit_price: '0.80' },
    ],
  })
  await ok(admin, 'POST', `/purchasing/purchases/${purchase.id}/receive/`)
  const prices: Json[] = await ok(
    admin,
    'GET',
    `/sales/pos-products/?branch=${branch.id}&currency=UZS&ids=${cola.id},${sugar.id}`,
  )
  const sugarPrice = Number(prices.find((p) => p.id === sugar.id).price) // 1,20 USD → so'm
  const total1 = 3 * 10000 + Math.round(1.5 * sugarPrice)

  const errors: string[] = []
  const ctxA = await newContext(browser)
  const ctxB = await newContext(browser)
  const ctxO = await newContext(browser)
  const framesB: Json[] = []
  ctxB.on('page', (p) =>
    p.on('websocket', (ws) =>
      ws.on('framereceived', (f) => {
        try {
          const m = JSON.parse(String(f.payload))
          if (m.type) framesB.push(m)
        } catch {
          /* ping/pong */
        }
      }),
    ),
  )
  const owner = await login(ctxO, ADMIN_USER, adminPassword(), errors)
  const a = await login(ctxA, kassirA.username, PASSWORD, errors)
  const b = await login(ctxB, kassirB.username, PASSWORD, errors)
  await owner.waitForSelector('[data-testid=kpi-sales_count-value]')
  await owner.waitForTimeout(800)
  const kpi = async () =>
    Number(
      norm(await owner.locator('[data-testid=kpi-sales_count-value]').textContent()).replace(
        /\D/g,
        '',
      ),
    )
  const before = await kpi()

  await a.click('a[href="/sales/pos"]')
  await b.click('a[href="/sales/pos"]')
  await b.fill('[data-testid=pos-search]', `Pepsi 1L ${sfx}`)
  const stockB = b.locator(`[data-testid=pos-stock-${cola.id}]`)
  await stockB.waitFor()
  check('B kassada qoldiq: 20 dona', norm(await stockB.textContent()) === '20 dona')

  // skaner (raqam + Enter), qidiruv, kasr miqdor
  await a.fill('[data-testid=pos-search]', barcode)
  await a.press('[data-testid=pos-search]', 'Enter')
  await a.waitForSelector(`[data-testid=cart-line-${cola.id}]`)
  await a.fill(`[data-testid=cart-qty-${cola.id}]`, '3')
  await a.fill('[data-testid=pos-search]', `Shakar oʻzbek ${sfx}`)
  await a.click(`[data-testid=pos-result-${sugar.id}]`)
  await a.fill(`[data-testid=cart-qty-${sugar.id}]`, '1,5')
  const shown = norm(await a.locator('[data-testid=pos-total]').textContent())
  check(`savat jami ${fmt(total1)} UZS`, shown === `${fmt(total1)} UZS`, shown)

  // F9 → to'lov, qaytim
  await a.keyboard.press('F9')
  await a.fill('[data-testid=pay-amount-1]', '60000')
  const change1 = 60000 - total1
  check(
    `qaytim ${fmt(change1)}`,
    norm(await a.locator('[data-testid=pay-change]').textContent()) === `${fmt(change1)} UZS`,
  )
  await a.click('[data-testid=pay-confirm]')
  await a.waitForSelector('[data-testid=sale-success]')
  await waitStock(b, `[data-testid=pos-stock-${cola.id}]`, '17 ')
  check('B kassada qoldiq jonli 17 dona', true)
  const sc = framesB.filter(
    (m) => m.type === 'stock.changed' && m.payload.document?.type === 'sale',
  )
  check(
    'B ga savdo stock.changed (tannarxsiz)',
    sc.length >= 2 && sc.every((m) => !('unit_cost_base' in m.payload)),
  )

  // chek PDF (Authorization bilan, iframe orqali chop etish)
  const receipt = a.waitForResponse((r) => /\/sales\/\d+\/receipt\/$/.test(r.url()))
  await a.click('[data-testid=success-print]')
  const resp = await receipt
  check(
    'chek PDF olindi',
    resp.status() === 200 && resp.headers()['content-type'] === 'application/pdf',
  )
  await a.waitForSelector('iframe[data-testid=print-frame]', { state: 'attached' })
  check(
    "chop etish iframe: URL da token yo'q",
    !((await a.locator('iframe[data-testid=print-frame]').getAttribute('src')) ?? '').includes(
      'token',
    ),
  )
  await a.click('[data-testid=success-new]')

  const tokA = await token(kassirA.username, PASSWORD)
  const sale1 = list(await ok(tokA, 'GET', '/sales/'))[0]
  const pdf = await fetch(`${API}/sales/${sale1.id}/receipt/`, {
    headers: { Authorization: `Bearer ${tokA}` },
  })
  const bytes = Buffer.from(await pdf.arrayBuffer())
  check('chek fayli PDF', bytes.subarray(0, 4).toString() === '%PDF' && bytes.length > 1000)

  await owner.waitForFunction(
    (n) =>
      Number(
        (document.querySelector('[data-testid=kpi-sales_count-value]')?.textContent ?? '0').replace(
          /\D/g,
          '',
        ),
      ) === n,
    before + 1,
  )
  check(`rahbar dashboardi jonli: ${before} → ${before + 1}`, true)

  // aralash valyuta: 1 USD → qaytim so'mda
  await a.fill('[data-testid=pos-search]', barcode)
  await a.press('[data-testid=pos-search]', 'Enter')
  await a.waitForSelector(`[data-testid=cart-line-${cola.id}]`)
  await a.click('[data-testid=pos-pay]')
  await a.selectOption('[data-testid=pay-currency-1]', 'USD')
  await a.fill('[data-testid=pay-amount-1]', '1')
  const change2Text = norm(await a.locator('[data-testid=pay-change]').textContent())
  await a.click('[data-testid=pay-confirm]')
  await a.waitForSelector('[data-testid=sale-success]')
  check(
    "1 USD bilan to'lov, qaytim so'mda",
    /^\d[\d ]* UZS$/.test(change2Text) && change2Text !== '0 UZS',
    change2Text,
  )
  await a.click('[data-testid=success-new]')
  const change2 = Number(change2Text.replace(/[^\d]/g, ''))

  await a.goto(`${BASE}/cash`)
  const uzsBox = a.locator(`[data-testid=cashbox-${branch.id}-UZS] [data-testid=cashbox-balance]`)
  await uzsBox.waitFor()
  const uzs = norm(await uzsBox.textContent())
  const usd = norm(
    await a
      .locator(`[data-testid=cashbox-${branch.id}-USD] [data-testid=cashbox-balance]`)
      .textContent(),
  )
  check(
    `kassa: ${fmt(total1 - change2)} UZS va 1,00 USD`,
    uzs === `${fmt(total1 - change2)} UZS` && usd === '1,00 USD',
    `${uzs}; ${usd}`,
  )

  // omborda yetmasa — server xatosi savat qatorida
  await a.goto(`${BASE}/sales/pos`)
  await a.fill('[data-testid=pos-search]', barcode)
  await a.press('[data-testid=pos-search]', 'Enter')
  await a.fill(`[data-testid=cart-qty-${cola.id}]`, '100')
  await a.click('[data-testid=pos-pay]')
  await a.click('[data-testid=pay-confirm]')
  const lineError = a.locator(`[data-testid=cart-line-${cola.id}]`, { hasText: 'Mavjud' })
  await lineError.waitFor()
  check(
    'omborda yetmasa: «Mavjud: 16» qatorda',
    norm(await lineError.textContent()).includes('Mavjud: 16'),
  )

  // bekor qilish: naqd yetmasa rad; 2-savdo bekor → qoldiq va kassa qaytadi
  await owner.goto(`${BASE}/sales/${sale1.id}`)
  await owner.click('[data-testid=sale-cancel]')
  await owner.locator('[role=dialog] input').fill('Mijoz qaytardi (e2e)')
  await owner.click('[data-testid=sale-cancel-confirm]')
  await owner.waitForSelector("text=Kassada yetarli naqd pul yo'q")
  check('kassada naqd yetmasa bekor qilinmaydi', true)
  await owner.keyboard.press('Escape')
  const sale2 = list(await ok(tokA, 'GET', '/sales/'))[0]
  await owner.goto(`${BASE}/sales/${sale2.id}`)
  await owner.click('[data-testid=sale-cancel]')
  await owner.locator('[role=dialog] input').fill('Xato urildi (e2e)')
  await owner.click('[data-testid=sale-cancel-confirm]')
  await owner.waitForSelector('text=Savdo bekor qilindi')
  await waitStock(b, `[data-testid=pos-stock-${cola.id}]`, '17 ')
  const boxes: Json[] = await ok(tokA, 'GET', `/payments/cashboxes/?branch=${branch.id}`)
  const bal = Object.fromEntries(boxes.map((x) => [x.currency_code, Number(x.balance)]))
  check(
    `bekor qilindi: qoldiq 17, kassa ${fmt(total1)} UZS / 0 USD`,
    bal.UZS === total1 && bal.USD === 0,
    bal,
  )

  // sotuvchi: bekor qilish tugmasi yo'q, sozlamalar 403
  await b.goto(`${BASE}/sales`)
  await b.waitForSelector(`td >> text=${sale1.number}`)
  await b.click(`td >> text=${sale1.number}`)
  await b.waitForSelector('[data-testid=sale-total]')
  check(
    "sotuvchida «Bekor qilish» yo'q",
    (await b.locator('[data-testid=sale-cancel]').count()) === 0,
  )
  await b.goto(`${BASE}/settings/payment-methods`)
  await b.waitForSelector("text=Ruxsat yo'q")
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  for (const ctx of [ctxA, ctxB, ctxO]) await ctx.close()
})
