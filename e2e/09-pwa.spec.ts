/**
 * 9-bosqich (PWA): manifest va o'rnatish mumkinligi (Chrome installability), service worker faqat
 * qobiqni keshlaydi (API yo'q), oflayn ochilsa «Internet yo'q» ekrani (login emas), aloqa tiklansa
 * o'zi davom etadi, ishlayotganda oflayn banner, oflayn mutatsiya darhol xato.
 * «Yangi versiya» oynasi — E2E_FRONTEND_DIR berilsa (dist qayta yig'iladi, vite preview bilan).
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { chromium, test, type BrowserContext } from '@playwright/test'

import { ADMIN_USER, BASE, adminPassword, check, uniq } from './helpers'

async function persistentContext(): Promise<{
  context: BrowserContext
  cleanup: () => Promise<void>
}> {
  // inkognito kontekstda Chrome PWA ni «o'rnatib bo'lmaydi» deydi — doimiy profil kerak
  const profile = mkdtempSync(join(tmpdir(), 'sevento-pwa-'))
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.E2E_CHROMIUM || undefined,
    args: ['--no-sandbox'],
    viewport: { width: 1366, height: 900 },
    timezoneId: 'Asia/Tashkent',
  })
  return {
    context,
    cleanup: async () => {
      await context.close()
      rmSync(profile, { recursive: true, force: true })
    },
  }
}

async function adminLogin(context: BrowserContext) {
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(`${BASE}/login`)
  await page.fill('#username', ADMIN_USER)
  await page.fill('#password', adminPassword())
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard/)
  await page.waitForSelector('[data-status="online"]')
  return page
}

test("PWA: o'rnatish, kesh va oflayn holat", async () => {
  const { context, cleanup } = await persistentContext()
  try {
    const page = context.pages()[0] ?? (await context.newPage())
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${BASE}/login`)
    const href = await page.getAttribute('link[rel=manifest]', 'href')
    const manifest = await (await fetch(`${BASE}${href}`)).json()
    const icons = manifest.icons.map(
      (i: { sizes: string; purpose: string }) => `${i.sizes}:${i.purpose}`,
    )
    check(
      'manifest: nom, standalone, ikonkalar (192, 512, maskable)',
      manifest.short_name === 'Sevento' &&
        manifest.display === 'standalone' &&
        manifest.lang === 'uz' &&
        ['192x192:any', '512x512:any', '512x512:maskable'].every((i) => icons.includes(i)),
      icons,
    )

    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready
      for (let i = 0; i < 50 && reg.active?.state !== 'activated'; i++)
        await new Promise((r) => setTimeout(r, 100))
      return reg.active?.state
    })
    check('service worker faollashdi', state === 'activated', state)

    const cdp = await context.newCDPSession(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
    check(
      "PWA o'rnatiladi (installability xatolari yo'q)",
      installabilityErrors.length === 0,
      installabilityErrors,
    )

    await adminLogin(context)
    await page.waitForSelector('[data-testid=kpi-revenue-value]')
    const cached = await page.evaluate(async () => {
      const urls: string[] = []
      for (const name of await caches.keys()) {
        for (const req of await (await caches.open(name)).keys())
          urls.push(new URL(req.url).pathname)
      }
      return urls
    })
    check(
      "keshda faqat ilova qobig'i (API, media yo'q)",
      cached.some((u) => u.endsWith('index.html')) &&
        !cached.some((u) => /^\/(api|ws|media|admin)\//.test(u)),
      cached.length,
    )

    // ishlayotganda internet uzildi → darhol banner
    await context.setOffline(true)
    await page.waitForSelector('[data-testid=offline-banner]', { timeout: 5000 })
    check("oflayn: banner darhol ko'rindi", true)

    // oflayn holda qayta ochish → keshdan qobiq + «Internet yo'q» (login emas)
    await page.reload()
    await page.waitForSelector('[data-testid=offline-screen]')
    check(
      "oflayn ochildi: «Internet yo'q» ekrani, login sahifasi emas",
      !page.url().includes('/login'),
      page.url(),
    )

    // aloqa tiklandi → sessiya o'zi tiklanadi
    await context.setOffline(false)
    await page.waitForSelector('[data-testid=offline-screen]', { state: 'detached' })
    await page.waitForSelector('[data-status="online"]')
    check("aloqa tiklandi: login so'ralmadi", !page.url().includes('/login'))

    // oflayn mutatsiya darhol xato (navbatga qo'yilmaydi)
    await page.goto(`${BASE}/settings/branches`)
    await page.click('text=Yangi nuqta')
    await page.fill('#branch-form input[name=code]', `of${uniq().slice(-4)}`)
    await page.fill('#branch-form input[name=name]', 'Oflayn nuqta')
    await context.setOffline(true)
    const t0 = Date.now()
    await page.click('button[form=branch-form]')
    await page
      .locator('[role=alert], [role=status]', { hasText: /aloqa|internet/i })
      .first()
      .waitFor({ timeout: 5000 })
    check('oflayn saqlash: darhol xato', Date.now() - t0 < 5000, `${Date.now() - t0} ms`)
    await context.setOffline(false)
    check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  } finally {
    await cleanup()
  }
})

test('PWA: yangi versiya — «Yangilash» oynasi', async () => {
  const dir = process.env.E2E_FRONTEND_DIR
  test.skip(
    !dir,
    "E2E_FRONTEND_DIR berilmagan (dist qayta yig'ilishi kerak — faqat vite preview bilan)",
  )
  const { context, cleanup } = await persistentContext()
  const marker = join(dir!, 'public', 'e2e-version.svg')
  try {
    const page = await adminLogin(context)
    await page.evaluate(() => navigator.serviceWorker.ready)
    execFileSync(
      'bash',
      [
        '-c',
        `echo '<svg xmlns="http://www.w3.org/2000/svg"><!-- ${Date.now()} --></svg>' > "${marker}" && cd "${dir}" && npx vite build`,
      ],
      { stdio: 'ignore' },
    )
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update())
    await page.waitForSelector('[data-testid=pwa-update]', { timeout: 30_000 })
    check("yangi versiya: «Yangilash» oynasi (sahifa o'zi qayta yuklanmadi)", true)
    const navigated = page.waitForEvent('framenavigated')
    await page.click('[data-testid=pwa-update] button:has-text("Yangilash")')
    await navigated
    await page.waitForSelector('[data-status="online"]')
    check('«Yangilash» → yangi versiya, sessiya saqlandi', !page.url().includes('/login'))
  } finally {
    rmSync(marker, { force: true })
    if (dir) execFileSync('bash', ['-c', `cd "${dir}" && npx vite build`], { stdio: 'ignore' })
    await cleanup()
  }
})
