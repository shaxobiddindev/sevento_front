/**
 * 7-bosqich: ko'chirish holati ikki nuqtada jonli (jo'natildi → qabul qiluvchida darhol toast,
 * ro'yxat va nishon; qabul qilindi/kamomad → jo'natuvchi va rahbarda), bekor qilish,
 * inventarizatsiya, hisobdan chiqarish, savdo qaytarish (naqd), qaytarishdan keyin bekor qilish yopiq.
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
  list,
  login,
  newContext,
  norm,
  ok,
  pickProduct,
  refs,
  stockQty,
  token,
  uniq,
  waitToast,
  type Json,
} from './helpers'

test("ko'chirish, inventarizatsiya, hisobdan chiqarish, qaytarish", async ({ browser }) => {
  const sfx = uniq()
  const admin = await adminToken()
  const ref = await refs(admin)
  const A = await createBranch(admin, `KA${sfx}`, `Do'kon A ${sfx}`)
  const B = await createBranch(admin, `KB${sfx}`, `Ombor B ${sfx}`, 'warehouse')
  const omborA = await createUser(admin, `omborA${sfx}`, ref.role('storekeeper'), [A.id])
  const omborB = await createUser(admin, `omborB${sfx}`, ref.role('storekeeper'), [B.id])
  const sotuvA = await createUser(admin, `sotuvA${sfx}`, ref.role('seller'), [A.id])
  const P = await ok(admin, 'POST', '/catalog/products/', {
    sku: `kp-${sfx}`,
    name: `Pechenye ${sfx}`,
    unit: ref.unit('dona'),
    barcode: `47${sfx}01`,
  })
  const Q = await ok(admin, 'POST', '/catalog/products/', {
    sku: `kq-${sfx}`,
    name: `Qahva ${sfx}`,
    unit: ref.unit('dona'),
    barcode: `47${sfx}02`,
  })
  await ok(admin, 'POST', `/catalog/products/${P.id}/set-price/`, {
    price_type: ref.retail,
    currency: ref.currency('UZS'),
    amount: '8000',
  })
  const supplier = await ok(admin, 'POST', '/purchasing/suppliers/', { name: `Ta'minotchi ${sfx}` })
  const purchase = await ok(admin, 'POST', '/purchasing/purchases/', {
    branch: A.id,
    supplier: supplier.id,
    currency: ref.currency('USD'),
    expenses: [],
    items: [
      { product: P.id, quantity: '50', unit_price: '0.40' },
      { product: Q.id, quantity: '20', unit_price: '2.00' },
    ],
  })
  await ok(admin, 'POST', `/purchasing/purchases/${purchase.id}/receive/`)

  const errors: string[] = []
  const ctxA = await newContext(browser)
  const ctxB = await newContext(browser)
  const ctxO = await newContext(browser)
  const ctxS = await newContext(browser)
  const omA = await login(ctxA, omborA.username, PASSWORD, errors)
  const omB = await login(ctxB, omborB.username, PASSWORD, errors)
  const owner = await login(ctxO, ADMIN_USER, adminPassword(), errors)
  const tokA = await token(omborA.username, PASSWORD)
  const tokB = await token(omborB.username, PASSWORD)

  await omB.click('a[href="/inventory/transfers"]')
  await omB.waitForSelector("text=Ko'chirish yo'q")

  // A: yangi ko'chirish (P 10, Q 4) → jo'natish
  await omA.click('a[href="/inventory/transfers"]')
  await omA.click("text=Yangi ko'chirish")
  await omA.waitForURL(/\/inventory\/transfers\/new$/)
  await omA.selectOption('[data-testid=transfer-to]', String(B.id))
  await pickProduct(omA, 0, `Pechenye ${sfx}`, `Pechenye ${sfx}`)
  await omA.locator('[data-testid=doc-line] input[inputmode=decimal]').nth(0).fill('10')
  await omA.click("text=Qator qo'shish")
  await pickProduct(omA, 1, `Qahva ${sfx}`, `Qahva ${sfx}`)
  await omA.locator('[data-testid=doc-line] input[inputmode=decimal]').nth(1).fill('4')
  await omA.click('[data-testid=transfer-send]')
  await omA.click('button:has-text("Jo\'natish") >> nth=-1')
  await omA.waitForURL(/\/inventory\/transfers\/\d+$/)
  await omA.waitForSelector('[data-testid=transfer-detail-status]:has-text("Yo\'lda")')
  check(
    "A: jo'natildi; qoldiq P 40, Q 16",
    (await stockQty(tokA, A.id, P.id)) === 40 && (await stockQty(tokA, A.id, Q.id)) === 16,
  )

  // B: sahifa yangilanmasdan toast, ro'yxat, nishon
  await waitToast(omB, "Yangi ko'chirish keldi")
  await omB.waitForSelector('[data-testid=transfer-status]:has-text("Yo\'lda")')
  check(
    "B: toast, ro'yxatda «Yo'lda», nishon = 1",
    norm(await omB.locator('[data-testid=nav-badge]').textContent()) === '1',
  )

  // B: qabul, Q dan 3 ta keldi (1 kam)
  await omB.click(`text=KO-KA${sfx}`)
  await omB.click('[data-testid=transfer-receive]')
  await omB.locator('[data-testid=receive-qty]').nth(1).fill('3')
  await omB.click('[data-testid=receive-confirm]')
  await omB.waitForSelector('[data-testid=transfer-detail-status]:has-text("Qabul qilindi")')
  check('B: qabul qilindi, kamomad hujjati', await omB.locator('text=Kamomad hujjati').isVisible())

  // A sahifasi jonli, kamomad toast A va rahbarda
  await omA.waitForSelector('[data-testid=transfer-detail-status]:has-text("Qabul qilindi")')
  await waitToast(omA, "Ko'chirishda kamomad")
  await waitToast(owner, "Ko'chirishda kamomad")
  check('A holati jonli; kamomad toast A va rahbarda', true)
  check(
    "B qoldig'i: P 10, Q 3",
    (await stockQty(tokB, B.id, P.id)) === 10 && (await stockQty(tokB, B.id, Q.id)) === 3,
  )
  const wo = list(await ok(admin, 'GET', `/inventory/write-offs/?search=HC-KB${sfx}`))
  check(
    'kamomad hisobdan chiqarildi (transfer_shortage, 2 USD)',
    wo.length === 1 &&
      wo[0].reason_code === 'transfer_shortage' &&
      Number(wo[0].total_cost_base) === 2,
  )

  // bekor qilish: B da toast va ro'yxat jonli
  const t2 = await ok(tokA, 'POST', '/inventory/transfers/', {
    from_branch: A.id,
    to_branch: B.id,
    items: [{ product: P.id, quantity: '5' }],
  })
  await omB.click('a[href="/inventory/transfers"]')
  await ok(tokA, 'POST', `/inventory/transfers/${t2.id}/send/`)
  await omB.locator('tr', { hasText: t2.number }).locator("text=Yo'lda").waitFor()
  await omA.goto(`${BASE}/inventory/transfers/${t2.id}`)
  await omA.click('button:has-text("Bekor qilish")')
  await omA.fill('[role=dialog] input', 'Mashina buzildi')
  await omA.click('[data-testid=reason-confirm]')
  await omA.waitForSelector('[data-testid=transfer-detail-status]:has-text("Bekor qilindi")')
  await waitToast(omB, "Ko'chirish bekor qilindi")
  await omB.locator('tr', { hasText: t2.number }).locator('text=Bekor qilindi').waitFor()
  check("bekor qilindi: B da jonli; A qoldig'i P 40", (await stockQty(tokA, A.id, P.id)) === 40)

  // inventarizatsiya: P sanaldi 38
  await omA.click('a[href="/inventory/counts"]')
  await omA.click('text=Yangi inventarizatsiya')
  await omA.click('[data-testid=count-create]')
  await omA.waitForURL(/\/inventory\/counts\/\d+$/)
  await omA.fill('input[placeholder="Nomi, artikul yoki shtrix-kod"]', `Pechenye ${sfx}`)
  await omA.waitForFunction(
    () => document.querySelectorAll('[data-testid=count-input]').length === 1,
  )
  await omA.fill('[data-testid=count-input]', '38')
  const diff = norm(await omA.locator('[data-testid=count-diff]').first().textContent())
  check('inventarizatsiya: farq oldindan (−2)', diff === '-2' || diff === '−2', diff)
  await omA.click('[data-testid=count-save]')
  await omA.waitForSelector('text=Saqlandi')
  await omA.click('[data-testid=count-complete]')
  await omA.click('button:has-text("Yakunlash") >> nth=-1')
  await omA.waitForSelector('text=Yakunlandi')
  check(
    'yakunlandi: P 38, Q 16',
    (await stockQty(tokA, A.id, P.id)) === 38 && (await stockQty(tokA, A.id, Q.id)) === 16,
  )

  // hisobdan chiqarish: Q 1 dona, «Buzilgan»
  await omA.click('a[href="/inventory/write-offs"]')
  await omA.waitForURL(/\/inventory\/write-offs$/)
  await omA.click('main >> text=Hisobdan chiqarish >> nth=-1')
  await omA.waitForURL(/\/inventory\/write-offs\/new$/)
  const reasons: Json[] = await ok(tokA, 'GET', '/inventory/write-off-reasons/')
  await omA.selectOption(
    '[data-testid=write-off-reason]',
    String(reasons.find((r) => r.code === 'damaged').id),
  )
  await pickProduct(omA, 0, `Qahva ${sfx}`, `Qahva ${sfx}`)
  await omA.locator('[data-testid=doc-line] input[inputmode=decimal]').nth(0).fill('1')
  await omA.click('[data-testid=write-off-submit]')
  await omA.click('[role=dialog] button:has-text("Hisobdan chiqarish")')
  await omA.waitForURL(/\/inventory\/write-offs\/\d+$/)
  const woTotal = norm(await omA.locator('[data-testid=write-off-total]').textContent())
  check(
    'hisobdan chiqarildi: 2,00 USD, Q 15',
    woTotal.includes('2,00') && (await stockQty(tokA, A.id, Q.id)) === 15,
    woTotal,
  )

  // savdo qaytarish (sotuvchi): 5 dona sotiladi (API), UI dan 2 tasi qaytariladi
  const sel = await login(ctxS, sotuvA.username, PASSWORD, errors)
  const tokS = await token(sotuvA.username, PASSWORD)
  const sale = await ok(tokS, 'POST', '/sales/', {
    branch: A.id,
    currency: ref.currency('UZS'),
    items: [{ product: P.id, quantity: '5' }],
    payments: [{ method: ref.method('cash'), currency: ref.currency('UZS'), amount: '40000' }],
  })
  const links = await sel
    .locator('nav a')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check(
    "sotuvchi menyusida ko'chirish yo'q, qaytarishlar bor",
    !links.includes('/inventory/transfers') && links.includes('/sales/returns'),
  )
  await sel.goto(`${BASE}/sales/${sale.id}`)
  await sel.click('[data-testid=sale-return]')
  await sel.fill('[data-testid=return-qty]', '2')
  await sel.fill('[data-testid=return-reason]', 'Qadoq ochilgan')
  check(
    'qaytarish oynasi: 16 000 UZS',
    norm(await sel.locator('[data-testid=return-summary]').textContent()).includes('16 000 UZS'),
  )
  await sel.click('[data-testid=return-submit]')
  await waitToast(sel, 'Qaytarildi')
  await sel.waitForSelector('[data-testid=sale-returns]')
  check(
    'savdo «Qisman qaytarilgan»; P 35',
    (await sel.locator('text=Qisman qaytarilgan').count()) > 0 &&
      (await stockQty(tokA, A.id, P.id)) === 35,
  )
  const boxes: Json[] = list(await ok(admin, 'GET', `/payments/cashboxes/?branch=${A.id}`))
  const uzs = boxes.find((c) => c.currency_code === 'UZS')
  check('kassa: 40 000 − 16 000 = 24 000', Number(uzs?.balance) === 24000, uzs?.balance)

  await owner.goto(`${BASE}/sales/${sale.id}`)
  await owner.waitForSelector('[data-testid=sale-returns]')
  check(
    "rahbar: qaytarish bor savdoda «Bekor qilish» yo'q",
    (await owner.locator('[data-testid=sale-cancel]').count()) === 0,
  )
  await owner.click('a[href="/sales/returns"]')
  await owner.locator('tr', { hasText: sale.number }).waitFor()
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  for (const ctx of [ctxA, ctxB, ctxO, ctxS]) await ctx.close()
})
