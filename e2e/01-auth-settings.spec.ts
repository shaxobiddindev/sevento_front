/**
 * 1-bosqich: kirish (refresh — httpOnly cookie, token localStorage da emas), nuqta va foydalanuvchi
 * yaratish, takroriy kod xatosi, rollar, tizim sozlamalari, audit, sahifa yangilanganda sessiya,
 * sotuvchi huquqlari (menyu, /403), chiqish.
 */
import { test } from '@playwright/test'

import { ADMIN_USER, BASE, PASSWORD, adminPassword, check, newContext, uniq } from './helpers'

test('kirish, sozlamalar va huquqlar', async ({ browser }) => {
  const sfx = uniq().slice(-4)
  const context = await newContext(browser)
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // anonim → login
  await page.goto(`${BASE}/settings/users`)
  await page.waitForURL(/\/login/)
  check("anonim → /login ga yo'naltirildi", page.url().includes('/login'))

  await page.fill('#username', ADMIN_USER)
  await page.fill('#password', 'xato-parol')
  await page.click('button[type=submit]')
  const alert = await page.locator('[role=alert]').first().textContent()
  check("noto'g'ri parol → xabar", /noto'g'ri/i.test(alert ?? ''), alert)

  // to'g'ri parol → avval so'ralgan sahifaga qaytadi
  await page.fill('#password', adminPassword())
  await page.click('button[type=submit]')
  await page.waitForURL(/\/settings\/users/)
  await page.waitForSelector('table')
  const refresh = (await context.cookies()).find((c) => c.name === 'sevento_refresh')
  check(
    'refresh cookie httpOnly, path /api/v1/auth/',
    !!refresh && refresh.httpOnly && refresh.path === '/api/v1/auth/',
  )
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  check(
    "localStorage/sessionStorage da token yo'q",
    !/eyJ|token|access|refresh/i.test(storage),
    storage,
  )

  // nuqta yaratish va takroriy kod
  await page.goto(`${BASE}/settings/branches`)
  await page.click('text=Yangi nuqta')
  await page.fill('#branch-form input[name=code]', `t${sfx}`)
  await page.fill('#branch-form input[name=name]', `Toshkent markaz ${sfx}`)
  await page.fill('#branch-form input[name=phone]', '+998712000000')
  await page.click('button[form=branch-form]')
  await page.waitForSelector('text=Nuqta yaratildi')
  await page.goto(`${BASE}/settings/branches?search=T${sfx}`)
  await page.waitForSelector(`td >> text=T${sfx}`)
  check("nuqta yaratildi (kod katta harfga o'tdi)", true)
  await page.click('text=Yangi nuqta')
  await page.fill('#branch-form input[name=code]', `T${sfx}`)
  await page.fill('#branch-form input[name=name]', 'Dublikat')
  await page.click('button[form=branch-form]')
  await page.waitForSelector('[role=alert]:has-text("band")')
  check('takroriy kod → formada xato', true)
  await page.keyboard.press('Escape')

  // foydalanuvchi (sotuvchi)
  await page.goto(`${BASE}/settings/users/new`)
  await page.fill('input[name=username]', `sotuvchi${sfx}`)
  await page.fill('input[name=full_name]', 'Ali Valiyev')
  await page.selectOption('select[name=role]', { label: 'Sotuvchi' })
  await page.fill('input[name=password]', PASSWORD)
  await page.click(`label:has-text("Toshkent markaz ${sfx}") input[type=checkbox]`)
  await page.click('button[type=submit]:has-text("Yaratish")')
  await page.waitForSelector('text=Foydalanuvchi yaratildi')
  await page.waitForURL(/\/settings\/users\/\d+/)
  check('foydalanuvchi yaratildi', true)

  await page.goto(`${BASE}/settings/roles`)
  await page.waitForSelector('td >> text=Rahbar')
  await page.goto(`${BASE}/settings/system`)
  await page.waitForSelector('code >> text=payments.default_due_days')
  await page.goto(`${BASE}/audit`)
  await page.waitForSelector('td >> text=Nuqta yaratildi')
  await page.waitForSelector('td >> text=Foydalanuvchi yaratildi')
  check('rollar, tizim sozlamalari, audit jurnali', true)

  // sahifa yangilanadi → sessiya refresh cookie orqali tiklanadi
  await page.reload()
  await page.waitForSelector('h1:has-text("Audit")')
  check('reload dan keyin sessiya saqlanadi', true)

  // sotuvchi: menyuda sozlamalar yo'q, /audit → 403, sarlavhada o'z nuqtasi
  await page.click('button[aria-label="Chiqish"]')
  await page.waitForURL(/\/login/)
  await page.fill('#username', `sotuvchi${sfx}`)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL(/\/dashboard/)
  check(
    "sotuvchi menyusida foydalanuvchilar yo'q",
    (await page.locator('a[href="/settings/users"]').count()) === 0,
  )
  await page.goto(`${BASE}/audit`)
  await page.waitForURL(/\/403/)
  const header = await page.textContent('header')
  check(
    "sotuvchi sarlavhasida o'z nuqtasi",
    (header ?? '').includes(`Toshkent markaz ${sfx}`),
    header,
  )

  await page.click('button[aria-label="Chiqish"]')
  await page.waitForURL(/\/login/)
  const after = (await context.cookies()).find((c) => c.name === 'sevento_refresh')
  check("chiqishdan keyin refresh cookie yo'q", !after)
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  await context.close()
})
