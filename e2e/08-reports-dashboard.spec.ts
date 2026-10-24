/**
 * 8-bosqich: rahbar dashboardi (KPI, grafiklar) savdoda jonli; buxgalter nuqta bo'yicha; hisobotlar —
 * rol bo'yicha ro'yxat, jadval va API bilan bir xil sonlar, PDF/Excel, og'ir hisobot fonda
 * (202 → report.ready → «Tayyorlangan fayllar»), nuqta ruxsati va begona fayl 404.
 */
import { test, type Download, type Page } from '@playwright/test'

import {
  ADMIN_USER,
  BASE,
  PASSWORD,
  adminPassword,
  adminToken,
  api,
  check,
  createBranch,
  createUser,
  digits,
  login,
  newContext,
  norm,
  ok,
  refs,
  token,
  uniq,
  waitText,
  waitToast,
  type Json,
} from './helpers'

/** Frontend formatidagi pul: 1 234,50 */
const money2 = (v: string | number) =>
  Number(v)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

async function download(page: Page, click: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), click()])
  const path = await (file as Download).path()
  const { readFileSync } = await import('node:fs')
  return {
    name: file.suggestedFilename(),
    head: readFileSync(path).subarray(0, 4).toString('latin1'),
  }
}

test('hisobotlar va rahbar dashboardi', async ({ browser }) => {
  const sfx = uniq()
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' })
  const admin = await adminToken()
  const ref = await refs(admin)
  const A = await createBranch(admin, `HA${sfx}`, `Do'kon H ${sfx}`)
  const B = await createBranch(admin, `HB${sfx}`, `Do'kon G ${sfx}`)
  const seller = await createUser(admin, `hsotuv${sfx}`, ref.role('seller'), [A.id])
  const keeper = await createUser(admin, `hombor${sfx}`, ref.role('storekeeper'), [A.id])
  const bux = await createUser(admin, `hbux${sfx}`, ref.role('accountant'), [A.id])
  const P = await ok(admin, 'POST', '/catalog/products/', {
    sku: `hp-${sfx}`,
    name: `Sharbat ${sfx}`,
    unit: ref.unit('dona'),
  })
  await ok(admin, 'POST', `/catalog/products/${P.id}/set-price/`, {
    price_type: ref.retail,
    currency: ref.currency('UZS'),
    amount: '12000',
  })
  const supplier = await ok(admin, 'POST', '/purchasing/suppliers/', {
    name: `Ta'minotchi H ${sfx}`,
  })
  const purchase = await ok(admin, 'POST', '/purchasing/purchases/', {
    branch: A.id,
    supplier: supplier.id,
    currency: ref.currency('UZS'),
    expenses: [],
    items: [{ product: P.id, quantity: '40', unit_price: '7000' }],
  })
  await ok(admin, 'POST', `/purchasing/purchases/${purchase.id}/receive/`)
  const tokS = await token(seller.username, PASSWORD)
  const tokK = await token(keeper.username, PASSWORD)
  const tokB = await token(bux.username, PASSWORD)
  const sell = (qty: number) =>
    ok(tokS, 'POST', '/sales/', {
      branch: A.id,
      currency: ref.currency('UZS'),
      items: [{ product: P.id, quantity: String(qty) }],
      payments: [
        { method: ref.method('cash'), currency: ref.currency('UZS'), amount: String(qty * 12000) },
      ],
    })
  await sell(2)

  // API ruxsatlari
  check(
    'sotuvchi: hisobotlar va dashboard 403',
    (await api(tokS, 'GET', '/reports/')).status === 403 &&
      (await api(tokS, 'GET', '/reports/dashboard/')).status === 403,
  )
  const keeperReports: string[] = (await ok(tokK, 'GET', '/reports/')).map((r: Json) => r.key)
  check(
    'omborchi: faqat ombor/kirim hisobotlari',
    keeperReports.includes('stock_balance') &&
      keeperReports.includes('purchases') &&
      !keeperReports.includes('sales_summary'),
  )
  check(
    'omborchi: boshqa nuqta hisobotiga 403',
    (await api(tokK, 'GET', `/reports/stock_balance/?branch=${B.id}`)).status === 403,
  )
  const bad = await api(admin, 'GET', '/reports/sales_summary/?date_from=2026-13-01')
  check(
    "noto'g'ri sana → 400 validation_error",
    bad.status === 400 && bad.data?.error?.code === 'validation_error',
  )

  const errors: string[] = []
  const ctxO = await newContext(browser, { acceptDownloads: true })
  const ctxB = await newContext(browser)
  const ctxS = await newContext(browser)
  const ctxK = await newContext(browser, { acceptDownloads: true })
  const owner = await login(ctxO, ADMIN_USER, adminPassword(), errors)
  const buxPage = await login(ctxB, bux.username, PASSWORD, errors)

  await owner.waitForSelector('[data-testid=executive-dashboard] [data-testid=kpi-revenue-value]')
  await owner.waitForSelector('[data-testid=sales-trend] .recharts-surface')
  check(
    'rahbar: 5 ta KPI (foyda bilan), savdo grafigi',
    (await owner.locator('[data-testid^=kpi-][data-testid$=-value]').count()) === 5,
  )

  // buxgalter: A nuqtasi bo'yicha (sarlavhadagi tanlov)
  const dashA = () => ok(tokB, 'GET', `/reports/dashboard/?period=today&branch=${A.id}`)
  await buxPage.selectOption('select[aria-label="Nuqta"]', String(A.id))
  const api0 = await dashA()
  const rev0 = await waitText(buxPage, '[data-testid=kpi-revenue-value]', (s) =>
    s.startsWith(money2(api0.kpi.revenue.value)),
  )
  check(
    'buxgalter: A da 1 savdo, tushum API bilan bir xil',
    digits(await buxPage.locator('[data-testid=kpi-sales_count-value]').textContent()) === 1 &&
      rev0.startsWith(money2(api0.kpi.revenue.value)),
    rev0,
  )

  // jonli: savdo → rahbar va buxgalter KPI
  const ownerCount0 = digits(
    await owner.locator('[data-testid=kpi-sales_count-value]').textContent(),
  )
  await sell(3)
  const ownerCount1 = await waitText(
    owner,
    '[data-testid=kpi-sales_count-value]',
    (s) => digits(s) === ownerCount0 + 1,
  )
  check(
    'jonli: rahbar savdolar soni +1',
    digits(ownerCount1) === ownerCount0 + 1,
    `${ownerCount0} → ${ownerCount1}`,
  )
  const buxCount = await waitText(
    buxPage,
    '[data-testid=kpi-sales_count-value]',
    (s) => digits(s) === 2,
  )
  const api1 = await dashA()
  const rev1 = await waitText(buxPage, '[data-testid=kpi-revenue-value]', (s) =>
    s.startsWith(money2(api1.kpi.revenue.value)),
  )
  const ratio = Number(api1.kpi.revenue.value) / Number(api0.kpi.revenue.value)
  check(
    "jonli: buxgalter 2 savdo, tushum 2,5 baravar (24 000 → 60 000 so'm)",
    digits(buxCount) === 2 && Math.abs(ratio - 2.5) < 0.02,
    `${rev0} → ${rev1}`,
  )

  await buxPage.click('[data-testid=executive-dashboard] button:has-text("7 kun")')
  await buxPage.click('button:has-text("Jadval")')
  await buxPage.waitForFunction(
    () => document.querySelectorAll('[data-testid=trend-table] tbody tr').length === 7,
  )
  check("7 kun: jadval ko'rinishida 7 qator", true)

  // sotuvchi: sodda bosh sahifa, /reports → 403
  const sel = await login(ctxS, seller.username, PASSWORD, errors)
  const nav = await sel
    .locator('nav a')
    .evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  check(
    "sotuvchi: rahbar dashboardi va hisobotlar yo'q",
    (await sel.locator('[data-testid=executive-dashboard]').count()) === 0 &&
      !nav.includes('/reports'),
  )
  await sel.goto(`${BASE}/reports`)
  await sel.waitForURL(/\/403$/)

  // hisobotlar (rahbar)
  await owner.click('a[href="/reports"]')
  await owner.waitForSelector('[data-testid=report-sales_summary]')
  check(
    'rahbar: 13 ta hisobot',
    (await owner.locator('[data-testid^=report-]:not([data-testid=report-jobs])').count()) === 13,
  )
  await owner.click('[data-testid=report-sales_by_product]')
  await owner.waitForURL(/\/reports\/sales_by_product/)
  await owner.click('button:has-text("Bugun")')
  await owner.selectOption('#report-filter-branch', String(A.id))
  const row = owner.locator('[data-testid=report-table] tbody tr', { hasText: `Sharbat ${sfx}` })
  await row.waitFor()
  const rowText = norm(await row.textContent())
  const apiRow = (
    await ok(
      admin,
      'GET',
      `/reports/sales_by_product/?date_from=${today}&date_to=${today}&branch=${A.id}`,
    )
  ).rows[0]
  check(
    "tovarlar bo'yicha: 5 dona, sonlar API bilan bir xil",
    apiRow.sold === '5.000' &&
      [apiRow.revenue, apiRow.cost, apiRow.profit].every((v: string) =>
        rowText.includes(money2(v)),
      ),
    rowText,
  )
  check(
    'filtr URL da saqlanadi',
    owner.url().includes(`branch=${A.id}`) && owner.url().includes('date_from='),
  )
  const pdf = await download(owner, () => owner.click('[data-testid=export-pdf]'))
  check('PDF yuklab olindi', pdf.name.endsWith('.pdf') && pdf.head === '%PDF', pdf.name)
  const xlsx = await download(owner, () => owner.click('[data-testid=export-xlsx]'))
  check('Excel yuklab olindi', xlsx.name.endsWith('.xlsx') && xlsx.head.startsWith('PK'), xlsx.name)

  // omborchi: og'ir hisobot fonda → report.ready → yuklab olish
  const keeperPage = await login(ctxK, keeper.username, PASSWORD, errors)
  await keeperPage.click('a[href="/reports"]')
  await keeperPage.waitForSelector('[data-testid=report-stock_movements]')
  check(
    'omborchi: 6 ta hisobot',
    (await keeperPage.locator('[data-testid^=report-]:not([data-testid=report-jobs])').count()) ===
      6,
  )
  await keeperPage.click('[data-testid=report-stock_movements]')
  await keeperPage.waitForSelector('[data-testid=report-table]')
  await keeperPage.click('[data-testid=export-xlsx]')
  await waitToast(keeperPage, 'Hisobot tayyorlanmoqda')
  await waitToast(keeperPage, 'Hisobot tayyor', 30_000)
  check("og'ir hisobot: 202 → «Hisobot tayyor» (report.ready)", true)
  const jobLink = keeperPage.locator('[data-testid=report-jobs] [data-testid=job-download]').first()
  await jobLink.waitFor()
  const job = await download(keeperPage, () => jobLink.click())
  check(
    'tayyorlangan faylni yuklab olish',
    job.name.startsWith('stock_movements-') && job.head.startsWith('PK'),
    job.name,
  )
  const jobs: Json[] = await ok(tokK, 'GET', '/reports/jobs/')
  check(
    'boshqa foydalanuvchi faylni ololmaydi (404)',
    (await api(tokB, 'GET', `/reports/jobs/${jobs[0].id}/download/`)).status === 404,
  )
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  for (const ctx of [ctxO, ctxB, ctxS, ctxK]) await ctx.close()
})
