/* Desktop e2e (Tauri, Linux WebKitGTK): haqiqiy ilova tauri-driver + WebKitWebDriver orqali
   boshqariladi. Kirish, WebSocket jonli (tauri:// origin), refresh token JS da yo'qligi va Rust
   cookie jarida (0600) saqlanishi, ilova qayta ochilganda sessiya tiklanishi, chiqish.

   Talablar: `cargo install tauri-driver`, `apt install webkit2gtk-driver xvfb`, ilova build qilingan
   (`VITE_API_URL=http://localhost:8000 npm run tauri:build -- --bundles deb`), backend :8000 da.
     Xvfb :99 &  DISPLAY=:99 tauri-driver --native-driver /usr/bin/WebKitWebDriver &
     E2E_ADMIN_PASSWORD=... npm run e2e:desktop
   Diqqat: ilova ma'lumotlari papkasi (~/.local/share/uz.sevento.desktop) tozalanadi. */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const DRIVER = process.env.DRIVER_URL || 'http://127.0.0.1:4444'
const APP =
  process.env.APP_BIN || new URL('../../src-tauri/target/release/sevento', import.meta.url).pathname
const API = `${process.env.E2E_API_URL || 'http://127.0.0.1:8000'}/api/v1`
const ADMIN_USER = process.env.E2E_ADMIN_USER || 'admin'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD
if (!ADMIN_PASSWORD) {
  console.error('E2E_ADMIN_PASSWORD kerak')
  process.exit(1)
}
const SHOTS = new URL('../../test-results/desktop', import.meta.url).pathname
fs.mkdirSync(SHOTS, { recursive: true })
const DATA_DIR = path.join(os.homedir(), '.local/share/uz.sevento.desktop')
const CACHE_DIR = path.join(os.homedir(), '.cache/uz.sevento.desktop')
const ELEMENT = 'element-6066-11e4-a52e-4f735466cecf'
const steps = []
const step = (name, ok, extra = '') => {
  steps.push(ok)
  console.log(`${ok ? 'OK ' : 'FAIL'} ${name} ${extra}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function wd(method, url, body) {
  const res = await fetch(`${DRIVER}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (json.value && json.value.error)
    throw new Error(`${method} ${url}: ${json.value.error} ${json.value.message}`)
  return json.value
}

class App {
  static async launch() {
    const value = await wd('POST', '/session', {
      capabilities: { alwaysMatch: { 'tauri:options': { application: APP } } },
    })
    return new App(value.sessionId)
  }
  constructor(id) {
    this.base = `/session/${id}`
  }
  async find(css) {
    const value = await wd('POST', `${this.base}/element`, { using: 'css selector', value: css })
    return value[ELEMENT]
  }
  async waitFor(css, timeout = 15000) {
    const until = Date.now() + timeout
    let last
    while (Date.now() < until) {
      try {
        return await this.find(css)
      } catch (e) {
        last = e
        await sleep(200)
      }
    }
    throw new Error(`kutilgan element yo'q: ${css} (${last?.message})`)
  }
  async click(css) {
    await wd('POST', `${this.base}/element/${await this.waitFor(css)}/click`, {})
  }
  async type(css, text) {
    await wd('POST', `${this.base}/element/${await this.waitFor(css)}/value`, { text })
  }
  exec(script, args = []) {
    return wd('POST', `${this.base}/execute/sync`, { script, args })
  }
  async text(css) {
    return wd('GET', `${this.base}/element/${await this.waitFor(css)}/text`)
  }
  async screenshot(file) {
    fs.writeFileSync(
      path.join(SHOTS, file),
      Buffer.from(await wd('GET', `${this.base}/screenshot`), 'base64'),
    )
  }
  quit() {
    return wd('DELETE', this.base)
  }
}

const sessionFile = path.join(DATA_DIR, 'session.json')
const jarHasRefresh = () =>
  fs.existsSync(sessionFile) && fs.readFileSync(sessionFile, 'utf8').includes('sevento_refresh')

;(async () => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
  fs.rmSync(CACHE_DIR, { recursive: true, force: true })
  let app
  try {
    // 1. Birinchi ochilish — sessiya yo'q → login
    app = await App.launch()
    await app.waitFor('#username', 30000)
    step("ilova ochildi: login sahifasi (sessiya yo'q)", true)
    const platform = await app.exec(
      "return [document.documentElement.dataset.platform, '__TAURI_INTERNALS__' in window, location.protocol]",
    )
    step(
      'desktop rejimi: Tauri ichida, ilova fayllari paket ichidan',
      platform[0] === 'desktop' && platform[1] === true && platform[2] === 'tauri:',
      JSON.stringify(platform),
    )

    // 2. Kirish → dashboard, WebSocket jonli
    await app.type('#username', ADMIN_USER)
    await app.type('#password', ADMIN_PASSWORD)
    await app.click('button[type=submit]')
    await app.waitFor('[data-testid=kpi-revenue-value]', 20000)
    await app.waitFor('[data-status="online"]', 15000)
    step('kirish: rahbar dashboardi, WebSocket «Jonli» (tauri:// origin)', true)
    await sleep(1500)
    await app.screenshot('95-tauri-dashboard.png')

    // 3. Refresh token JS ga ko'rinmaydi; Rust cookie jarida, faqat egasi o'qiy oladi
    const cookie = await app.exec('return document.cookie')
    step("refresh token JS da yo'q (document.cookie bo'sh)", cookie === '', JSON.stringify(cookie))
    const mode = fs.existsSync(sessionFile)
      ? (fs.statSync(sessionFile).mode & 0o777).toString(8)
      : '-'
    step(
      'refresh cookie Rust jarida saqlandi (session.json, 0600)',
      jarHasRefresh() && mode === '600',
      `mode=${mode}`,
    )

    // 4. Jonli xabar (system.notice) Tauri oynasiga keladi
    const { access } = await (
      await fetch(`${API}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
      })
    ).json()
    const notice = `Desktop test xabari ${Date.now().toString().slice(-5)}`
    await fetch(`${API}/realtime/notice/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
      body: JSON.stringify({ level: 'info', message: notice }),
    })
    const until = Date.now() + 10000
    let seen = false
    while (!seen && Date.now() < until) {
      seen = await app.exec('return document.body.innerText.includes(arguments[0])', [notice])
      if (!seen) await sleep(200)
    }
    step("WebSocket: tizim xabari desktop oynasida darhol ko'rindi", seen)
    await app.screenshot('96-tauri-notice.png')

    // 5. Hisobotlar sahifasi (plugin-http orqali REST)
    await app.click('a[href="/reports"]')
    await app.waitFor('[data-testid=report-sales_summary]', 15000)
    step("REST (plugin-http): hisobotlar ro'yxati yuklandi", true)

    // 6. Ilovani yopib qayta ochish — sessiya Rust jaridan tiklanadi (login so'ralmaydi)
    await app.quit()
    await sleep(1000)
    app = await App.launch()
    await app.waitFor('[data-testid=kpi-revenue-value]', 30000)
    step("qayta ochildi: sessiya tiklandi, login so'ralmadi (refresh — Rust orqali)", true)

    // 7. Chiqish → jardagi refresh cookie o'chadi; qayta ochilganda login
    await app.exec(
      "[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Chiqish')).click()",
    )
    await app.waitFor('#username', 15000)
    await sleep(500)
    step("chiqish: login sahifasi, refresh cookie jardan o'chdi", !jarHasRefresh())
    await app.quit()
    await sleep(1000)
    app = await App.launch()
    await app.waitFor('#username', 30000)
    step('chiqishdan keyin qayta ochildi: login sahifasi', true)
    await app.screenshot('97-tauri-login.png')
  } catch (e) {
    console.error(e)
    steps.push(false)
  } finally {
    if (app) await app.quit().catch(() => {})
  }
  const passed = steps.filter(Boolean).length
  console.log(`\n${passed}/${steps.length} qadam o'tdi`)
  process.exit(passed === steps.length ? 0 : 1)
})()
