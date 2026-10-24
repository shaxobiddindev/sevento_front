import { defineConfig } from '@playwright/test'

/**
 * Brauzer e2e testlari (e2e/*.spec.ts). Ishlab turgan backend va frontend kerak:
 *   backend: uvicorn + celery worker (hisobotlar uchun), `bootstrap` qilingan baza
 *   frontend: `npm run build && npx vite preview --port 4173` (yoki docker compose: :3000)
 *
 *   E2E_ADMIN_PASSWORD=... npm run e2e
 *   E2E_BASE_URL=http://localhost:3000 E2E_ADMIN_PASSWORD=... npm run e2e
 *
 * Testlar har safar o'z nuqta, foydalanuvchi va tovarlarini yaratadi (mavjud ma'lumotga bog'liq emas).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts$/,
  // testlar umumiy backend bilan ishlaydi — ketma-ket
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    timezoneId: 'Asia/Tashkent',
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // lokal: o'rnatilgan Chromium (E2E_CHROMIUM); CI: `npx playwright install chromium`
      executablePath: process.env.E2E_CHROMIUM || undefined,
      args: ['--no-sandbox'],
    },
  },
})
