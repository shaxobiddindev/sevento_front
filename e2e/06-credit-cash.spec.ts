/**
 * 6-bosqich: buxgalter mijoz yaratadi (limit), POS da nasiya, buxgalter ekranida qarz jonli,
 * limitdan oshsa tugma yopiq va server 409, 80% ogohlantirish toast, qarz to'lovi jonli,
 * to'liq yopish summasi, smena (kiritish jonli, yopishda farq), sotuvchida smena tugmalari yo'q.
 * Muddati o'tgan qarz (Celery Beat) — backend testlarida (apps/payments/tests).
 */
import { test } from '@playwright/test'

import {
  BASE,
  PASSWORD,
  adminToken,
  api,
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

test("nasiya, qarz to'lovi va kassa smenasi", async ({ browser }) => {
  const sfx = uniq()
  const admin = await adminToken()
  const ref = await refs(admin)
  const branch = await createBranch(admin, `N${sfx}`, `Nasiya do'kon ${sfx}`)
  const kassir = await createUser(admin, `kassir${sfx}`, ref.role('seller'), [branch.id])
  const buxgalter = await ok(admin, 'POST', '/users/', {
    username: `buxgalter${sfx}`,
    password: PASSWORD,
    full_name: 'Buxgalter E2E',
    role: ref.role('accountant'),
  })
  const barcode = `48${sfx}02`
  const product = await ok(admin, 'POST', '/catalog/products/', {
    sku: `nasiya-${sfx}`,
    name: `Choy 100g ${sfx}`,
    unit: ref.unit('dona'),
    barcode,
  })
  await ok(admin, 'POST', `/catalog/products/${product.id}/set-price/`, {
    price_type: ref.retail,
    currency: ref.currency('UZS'),
    amount: '10000',
  })
  const supplier = await ok(admin, 'POST', '/purchasing/suppliers/', {
    name: `Choy ta'minot ${sfx}`,
  })
  const purchase = await ok(admin, 'POST', '/purchasing/purchases/', {
    branch: branch.id,
    supplier: supplier.id,
    currency: ref.currency('USD'),
    expenses: [],
    items: [{ product: product.id, quantity: '200', unit_price: '0.40' }],
  })
  await ok(admin, 'POST', `/purchasing/purchases/${purchase.id}/receive/`)
  const latest: Json[] = await ok(admin, 'GET', '/currency-rates/latest/')
  const rate = Number(latest.find((r) => r.code === 'USD').rate)

  const errors: string[] = []
  const ctxA = await newContext(browser)
  const ctxS = await newContext(browser)
  const acc = await login(ctxA, buxgalter.username, PASSWORD, errors)
  const sel = await login(ctxS, kassir.username, PASSWORD, errors)
  const customerName = `Rahimov Jasur ${sfx}`

  // buxgalter: mijoz, limit 50 USD
  await acc.click('a[href="/customers"]')
  await acc.click('[data-testid=customer-new]')
  await acc.fill('#customer-form input[name=name]', customerName)
  await acc.fill('#customer-form input[name=phone]', `+99890${sfx}11`)
  await acc.fill('[data-testid=customer-limit]', '50')
  await acc.click('[data-testid=customer-save]')
  await acc.waitForURL(/\/customers\/\d+$/)
  const customerId = Number(acc.url().split('/').pop())
  await acc.waitForSelector('[data-testid=credit-available]')
  check(
    'mijoz yaratildi, mavjud kredit 50 USD',
    norm(await acc.locator('[data-testid=credit-available]').textContent()) === '50,00 USD',
  )

  // POS: 3 dona (30 000), 10 000 naqd, qolgani nasiya
  const pickCustomer = async () => {
    await sel.locator('input[role=combobox][aria-label="Mijozlar"]').fill(customerName)
    await sel.locator('[role=option]', { hasText: customerName }).first().click()
    await sel.waitForSelector('[data-testid=pos-customer-credit]')
  }
  await sel.click('a[href="/sales/pos"]')
  await sel.fill('[data-testid=pos-search]', barcode)
  await sel.press('[data-testid=pos-search]', 'Enter')
  await sel.waitForSelector(`[data-testid=cart-line-${product.id}]`)
  await sel.fill(`[data-testid=cart-qty-${product.id}]`, '3')
  await pickCustomer()
  check(
    "POS: mijozning mavjud krediti ko'rindi",
    norm(await sel.locator('[data-testid=pos-customer-credit]').textContent()).includes(
      '50,00 USD',
    ),
  )
  await sel.click('[data-testid=pos-pay]')
  await sel.fill('[data-testid=pay-amount-1]', '10000')
  check(
    "to'lov oynasi: nasiyaga 20 000 UZS",
    norm(await sel.locator('[data-testid=pay-credit]').textContent()) === '20 000 UZS',
  )
  await sel.click('[data-testid=pay-confirm]')
  await sel.waitForSelector('[data-testid=success-debt]')
  await sel.click('[data-testid=success-new]')

  await acc.waitForFunction(() =>
    (document.querySelector('[data-testid=customer-balances]')?.textContent ?? '')
      .replace(/\s/g, '')
      .includes('20000'),
  )
  check('buxgalter: mijoz qarzi jonli 20 000 UZS', true)

  // limitdan oshish: tugma yopiq, server 409
  const big = Math.ceil((50 * rate - 20000) / 10000) + 1
  await sel.fill('[data-testid=pos-search]', barcode)
  await sel.press('[data-testid=pos-search]', 'Enter')
  await sel.fill(`[data-testid=cart-qty-${product.id}]`, String(big))
  await pickCustomer()
  await sel.click('[data-testid=pos-pay]')
  await sel.click('[data-testid=pay-remove-1]')
  await sel.waitForSelector('text=Kredit limiti yetmaydi')
  check(
    `limitdan oshsa (${big} dona) tugma yopiq`,
    await sel.locator('[data-testid=pay-confirm]').isDisabled(),
  )
  await sel.keyboard.press('Escape')
  const kassirToken = await token(kassir.username, PASSWORD)
  const over = await api(kassirToken, 'POST', '/sales/', {
    branch: branch.id,
    currency: ref.currency('UZS'),
    items: [{ product: product.id, quantity: String(big) }],
    payments: [],
    customer: customerId,
  })
  check(
    'server ham rad etdi: 409 credit_limit_exceeded',
    over.status === 409 && over.data?.error?.code === 'credit_limit_exceeded',
  )

  // 80% ogohlantirish
  const warnQty = Math.ceil((40 * rate - 20000) / 10000) + 1
  await ok(kassirToken, 'POST', '/sales/', {
    branch: branch.id,
    currency: ref.currency('UZS'),
    items: [{ product: product.id, quantity: String(warnQty) }],
    payments: [],
    customer: customerId,
  })
  await acc.waitForSelector(`text=Kredit limitiga yaqin: ${customerName}`)
  check('80% dan oshdi → buxgalterda toast', true)

  // qarz to'lovi (kassir) → buxgalterda jonli
  await sel.goto(`${BASE}/customers/${customerId}`)
  await sel.click('[data-testid=customer-pay]')
  await sel.fill('[data-testid=debt-pay-amount]', '15000')
  await sel.click('[data-testid=debt-pay-confirm]')
  await sel.waitForSelector("text=To'lov qabul qilindi")
  const expectedUzs = 20000 + warnQty * 10000 - 15000
  await acc.waitForFunction(
    (want) =>
      (document.querySelector('[data-testid=customer-balances]')?.textContent ?? '')
        .replace(/\s/g, '')
        .includes(want),
    String(expectedUzs),
  )
  check(`qarz to'lovi jonli: qoldiq ${fmt(expectedUzs)} UZS`, true)
  await acc.goto(`${BASE}/payments`)
  await acc.waitForSelector(`td >> text=${customerName}`)
  const payoff = await ok(
    kassirToken,
    'GET',
    `/payments/customers/${customerId}/payoff/?currency=USD`,
  )
  check("to'lovlar jurnali; to'liq yopish summasi USD da", Number(payoff.amount) > 0, payoff.amount)

  // smena: ochish, kiritish (sotuvchida jonli), yopishda farq
  await acc.goto(`${BASE}/cash`)
  await acc.selectOption('select[aria-label="Nuqta"]', String(branch.id))
  await acc.click('[data-testid=shift-open]')
  await acc.waitForSelector('text=Smena ochildi')
  await sel.goto(`${BASE}/cash`)
  const balanceSel = `[data-testid=cashbox-${branch.id}-UZS] [data-testid=cashbox-balance]`
  await sel.locator(balanceSel).waitFor()
  const before = Number(norm(await sel.locator(balanceSel).textContent()).replace(/[^\d]/g, ''))
  await acc.click('[data-testid=entry-new]')
  await acc.selectOption('[data-testid=entry-direction]', 'in')
  await acc.selectOption('[data-testid=entry-category]', 'deposit')
  await acc.selectOption('[data-testid=entry-currency]', 'UZS')
  await acc.fill('[data-testid=entry-amount]', '100000')
  await acc.fill('[data-testid=entry-note]', 'Maydalik uchun (e2e)')
  await acc.click('[data-testid=entry-save]')
  await acc.waitForSelector('text=Kassa yozuvi saqlandi')
  await sel.waitForFunction(
    ({ selector, want }) =>
      Number((document.querySelector(selector)?.textContent ?? '').replace(/[^\d]/g, '')) === want,
    { selector: balanceSel, want: before + 100000 },
  )
  check(`kassaga kiritish sotuvchida jonli: ${fmt(before)} → ${fmt(before + 100000)}`, true)

  await acc.click('[data-testid=shift-close]')
  await acc.locator('[data-testid=shift-actual-UZS]').fill(String(before + 100000 - 1000))
  await acc.click('[data-testid=shift-close-confirm]')
  await acc.waitForSelector('text=Smena yopildi')
  const boxes: Json[] = list(
    await ok(kassirToken, 'GET', `/payments/cashboxes/?branch=${branch.id}`),
  )
  const uzs = Number(boxes.find((b) => b.currency_code === 'UZS').balance)
  check(
    `smena yopildi: kassa sanalganga teng (${fmt(before + 99000)})`,
    uzs === before + 99000,
    uzs,
  )
  check(
    "sotuvchida smena va qo'lda yozuv tugmalari yo'q",
    (await sel
      .locator('[data-testid=shift-open], [data-testid=shift-close], [data-testid=entry-new]')
      .count()) === 0,
  )
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  await ctxA.close()
  await ctxS.close()
})
