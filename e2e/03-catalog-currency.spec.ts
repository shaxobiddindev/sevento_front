/**
 * 3-bosqich: ma'lumotnomalar, kategoriya daraxti, tovar + narx, sotuvchi faqat ko'radi,
 * kurs kiritilsa boshqa oynada darhol toast (WebSocket), CBU tugmasi natijasi.
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
  norm,
  refs,
  uniq,
} from './helpers'

test('katalog, narx va valyuta kursi', async ({ browser }) => {
  const sfx = uniq()
  const tok = await adminToken()
  const ref = await refs(tok)
  const branch = await createBranch(tok, `KT${sfx}`, `Katalog ${sfx}`)
  const seller = await createUser(tok, `ktsotuv${sfx}`, ref.role('seller'), [branch.id])
  const errors: string[] = []
  const adminCtx = await newContext(browser)
  const sellerCtx = await newContext(browser)
  const admin = await login(adminCtx, ADMIN_USER, adminPassword(), errors)

  await admin.click('a[href="/catalog/references"]')
  await admin.waitForSelector('td >> text=Kilogramm')
  await admin.waitForSelector('td >> text=Chakana')
  check("ma'lumotnomalar: birliklar va narx turlari", true)

  // kategoriya daraxti
  await admin.goto(`${BASE}/catalog/categories`)
  await admin.click('button:has-text("Yangi kategoriya")')
  await admin.fill('#category-form input[name=name]', `Ichimliklar ${sfx}`)
  await admin.click('button[form=category-form]')
  await admin.waitForSelector('text=Kategoriya yaratildi')
  const row = admin.locator('li', { hasText: `Ichimliklar ${sfx}` }).first()
  await row.hover()
  await row.locator('button[aria-label="Ichki kategoriya"]').first().click()
  await admin.fill('#category-form input[name=name]', `Suv ${sfx}`)
  await admin.click('button[form=category-form]')
  await admin.waitForSelector(`text=Suv ${sfx}`)
  check('kategoriya daraxti: ildiz va ichki', true)

  // tovar va narx
  const name = `Toshkent suvi 1.5L ${sfx}`
  await admin.goto(`${BASE}/catalog/products/new`)
  await admin.fill('input[name=sku]', `suv-${sfx}`)
  await admin.fill('input[name=name]', name)
  await admin.fill('input[name=barcode]', `478${sfx}0001`)
  const option = admin.locator('select[name=category] option', { hasText: `Suv ${sfx}` })
  await admin.selectOption('select[name=category]', (await option.getAttribute('value')) ?? '')
  await admin.click('button[type=submit]:has-text("Yaratish")')
  await admin.waitForSelector('text=Tovar yaratildi')
  await admin.waitForURL(/\/catalog\/products\/\d+$/)
  check(
    'tovar yaratildi (artikul katta harfda)',
    (await admin.inputValue('input[name=sku]')) === `SUV-${sfx}`,
  )
  await admin.click('button:has-text("Narx qo\'yish")')
  await admin.selectOption('#price-form select[name=currency]', { label: 'UZS' })
  await admin.fill('#price-form input[name=amount]', '5500')
  await admin.click('button[form=price-form]')
  await admin.waitForSelector('text=Narx saqlandi')
  const price = norm(await admin.locator('[data-testid="price-retail-UZS"]').textContent())
  check('narx kartasi: 5 500 UZS', price.includes('5 500'), price)

  await admin.goto(`${BASE}/catalog/products`)
  await admin.fill('input[type=search]', `SUV-${sfx}`)
  await admin.waitForSelector(`td >> text=${name}`)
  check(
    "ro'yxatda narx ko'rinadi",
    norm(await admin.locator('tr', { hasText: name }).textContent()).includes('5 500'),
  )

  // sotuvchi: faqat ko'rish
  const sellerPage = await login(sellerCtx, seller.username, PASSWORD, errors)
  await sellerPage.goto(`${BASE}/catalog/products`)
  await sellerPage.fill('input[type=search]', `SUV-${sfx}`)
  await sellerPage.waitForSelector(`td >> text=${name}`)
  check(
    "sotuvchi: «Yangi tovar» yo'q",
    (await sellerPage.locator('button:has-text("Yangi tovar")').count()) === 0,
  )
  await sellerPage.click(`td >> text=${name}`)
  await sellerPage.waitForSelector("text=Ko'rish rejimi")
  check(
    "sotuvchi: tovar faqat ko'rish rejimida",
    (await sellerPage.locator('button:has-text("Narx qo\'yish")').count()) === 0,
  )
  await sellerPage.goto(`${BASE}/dashboard`)

  // kurs → sotuvchida toast
  await admin.goto(`${BASE}/currency`)
  await admin.click('button:has-text("Kursni kiritish")')
  await admin.fill('#rate-form input[name=rate]', '12650,45')
  await admin.click('button[form=rate-form]')
  await admin.waitForSelector('text=Kurs saqlandi')
  check(
    'kurs kartasi yangilandi',
    norm(await admin.locator('[data-testid="rate-USD"]').textContent()).includes('12 650,45'),
  )
  await sellerPage.waitForSelector('text=Valyuta kursi yangilandi', { timeout: 5000 })
  const toast = norm(
    await sellerPage.locator('[role=status]', { hasText: 'Valyuta kursi' }).first().textContent(),
  )
  check('sotuvchi oynasida kurs toast (WebSocket)', toast.includes('USD = 12 650,45'), toast)

  // CBU: tarmoq yopiq muhitda ham foydalanuvchiga tushunarli natija
  await admin.click('button:has-text("Markaziy bankdan yangilash")')
  const outcome = await Promise.race([
    admin
      .waitForSelector('text=Kurs manbai (Markaziy bank) javob bermadi', { timeout: 20_000 })
      .then(() => 'xato'),
    admin.waitForSelector('text=Kurslar yangilandi', { timeout: 20_000 }).then(() => 'ok'),
  ])
  check("CBU tugmasi: natija ko'rsatildi", true, outcome)

  await sellerPage.goto(`${BASE}/currency`)
  await sellerPage.waitForSelector('[data-testid="rate-USD"]')
  check(
    "sotuvchi: kursni ko'radi, kirita olmaydi",
    (await sellerPage.locator('button:has-text("Kursni kiritish")').count()) === 0,
  )
  check("sahifada JS xatosi yo'q", errors.length === 0, errors.join(' | '))
  await adminCtx.close()
  await sellerCtx.close()
})
