# Sevento — frontend

React 19 + TypeScript + Vite 8. Backend alohida repoda: [sevento_back](https://github.com/shaxobiddindev/sevento_back) (REST `/api/v1/` + WebSocket `/ws/v1/`).

## Holat

| Bosqich | Holat |
|---|---|
| 1. Skelet: API klient (refresh, xatolar), auth (cookie), layout, login, foydalanuvchilar/rollar/nuqtalar/tizim sozlamalari/audit sahifalari | ✅ |
| 2. Realtime klient (ticket, backoff, ping/pong, invalidate xaritasi, holat indikatori, polling fallback) | ✅ |
| 3. Katalog (tovarlar, narxlar, kategoriya daraxti, ma'lumotnomalar), valyuta kursi, valyutalar | ✅ |
| 4. Kirim (forma, tannarx oldindan hisobi, qabul, bekor qilish), yetkazib beruvchilar, xarajat turlari, qoldiq, harakatlar, tovar kartasi, minimal qoldiq; qoldiq `stock.changed` bilan jonli | ✅ |
| 5. Kassa (POS: skaner, savat, aralash valyuta, qaytim, chek chop etish), savdolar, bekor qilish, kassa qoldig'i, to'lov turlari, dashboard da bugungi savdo; qoldiq ikki kassada jonli | ✅ |
| 6. Mijozlar (karta, kredit holati, akt-sverka), qarzlar, to'lovlar jurnali (qaytarish), POS da mijoz va nasiya, qarz to'lovi, kassa smenasi va qo'lda yozuv, buxgalter bildirishnomalari | ✅ |
| 7. Ko'chirish, inventarizatsiya, hisobdan chiqarish, savdo qaytarish | ✅ |
| 8. Hisobotlar (filtrlar, PDF/Excel, fondagi fayllar), rahbar dashboardi (Recharts, jonli) | ✅ |
| 9. PWA (o'rnatish, oflayn ekran, yangilanish oynasi) va Tauri desktop (Linux, Windows, macOS) | ✅ |
| 10. Yakun: brauzer e2e testlari repoda (Playwright, 9 oqim), desktop e2e, CI, hujjatlar | ✅ |

Tuzilma va qoidalar: [docs/architecture.md](docs/architecture.md). Umumiy hujjatlar (arxitektura, ER, hodisalar, WebSocket, huquqlar, bosqichlar) — `sevento_back/docs/`.

## Ishga tushirish

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173 — /api va /ws → VITE_PROXY_TARGET (default http://localhost:8000)
```

Backend lokal ishlab turishi kerak (`sevento_back` README). Boshlang'ich login: backend `.env` dagi `BOOTSTRAP_ADMIN_*`.

## Skriptlar

| Skript | Nima qiladi |
|---|---|
| `npm run gen:api` | OpenAPI sxemadan TypeScript turlari → `src/shared/api/schema.d.ts` (manba: `OPENAPI_URL` yoki `../sevento_back/docs/api/openapi.yaml`) |
| `npm run lint` / `format:check` / `typecheck` | ESLint (feature chegaralari qoidasi bilan), Prettier, `tsc -b` |
| `npm test` | Vitest + Testing Library + MSW |
| `npm run build` | production build → `dist/` |
| `docker build -t sevento-front .` | Nginx image (`/api`, `/ws` → `backend:8000`); compose backend repoda |
| `npm run tauri:dev` | desktop ilova (dev): Vite + Tauri oynasi, server `http://localhost:8000` |
| `npm run tauri:build` | desktop paketlari → `src-tauri/target/release/bundle/` (`VITE_API_URL` majburiy) |
| `npm run e2e` / `e2e:desktop` | brauzer e2e (Playwright) / desktop e2e (tauri-driver) |

## E2E testlar

Brauzer e2e (`e2e/*.spec.ts`, Playwright Test) ishlab turgan tizimga qarshi ishlaydi va har safar o'z nuqta, foydalanuvchi va tovarlarini yaratadi — **alohida (sinov) bazada** ishga tushiring, ishchi bazada emas (kurs kiritadi, savdo qiladi).

```bash
# 1) backend: uvicorn + celery worker (hisobot fayllari uchun), `bootstrap` qilingan baza
# 2) frontend: npm run build && npx vite preview --port 4173   (yoki docker compose: E2E_BASE_URL=http://localhost:3000)
npx playwright install chromium            # bir marta
E2E_ADMIN_PASSWORD=<rahbar paroli> npm run e2e
```

| Fayl | Nimani tekshiradi |
|---|---|
| `01-auth-settings` | kirish (refresh — httpOnly cookie, token xotirada), nuqta/foydalanuvchi, audit, huquqlar, chiqish |
| `02-realtime` | `system.notice` jonli, rol o'zgarsa `session.revoked`, o'chirilsa tizimdan chiqarish |
| `03-catalog-currency` | kategoriya daraxti, tovar va narx, kurs → boshqa oynada toast |
| `04-purchasing-stock` | kirim (USD + so'mda xarajat), tannarx, qabul → qoldiq jonli, «Kam qoldi» |
| `05-pos` | ikki kassa, skaner, qaytim, aralash valyuta, chek PDF, bekor qilish, dashboard jonli |
| `06-credit-cash` | nasiya, kredit limiti (UI + 409), 80% ogohlantirish, qarz to'lovi jonli, smena |
| `07-inventory-documents` | ko'chirish ikki nuqtada jonli, kamomad, inventarizatsiya, hisobdan chiqarish, qaytarish |
| `08-reports-dashboard` | dashboard jonli, hisobotlar API bilan bir xil, PDF/Excel, fondagi hisobot (`report.ready`) |
| `09-pwa` | o'rnatish (installability), faqat qobiq keshlanadi, oflayn ekran va banner, yangi versiya oynasi |

Backend sinov muhitida login cheklovini yumshating: `THROTTLE_LOGIN=1000/min` (aks holda testlar 429 oladi).

Muhit: `E2E_BASE_URL` (default `http://127.0.0.1:4173`), `E2E_ADMIN_USER` (`admin`), `E2E_ADMIN_PASSWORD` (majburiy), `E2E_CHROMIUM` (o'rnatilgan Chromium yo'li, ixtiyoriy), `E2E_FRONTEND_DIR` («Yangi versiya» testi uchun).
CI: `.github/workflows/e2e.yml` (qo'lda yoki har kecha) backend repo, Postgres, Redis, Celery bilan to'liq ko'taradi.
Desktop e2e (haqiqiy Tauri ilovasi, tauri-driver): `npm run e2e:desktop` — talablar fayl boshida (`e2e/desktop/tauri.e2e.mjs`).

## PWA

`npm run build` service worker va manifest bilan chiqadi. HTTPS saytda (yoki localhost) brauzer "O'rnatish" taklif qiladi.
Faqat ilova qobig'i keshlanadi — ma'lumotlar doim serverdan; internet yo'q bo'lsa "Internet yo'q" ekrani, yangi versiya chiqsa "Yangilash" oynasi.

## Desktop (Tauri)

Talablar: Rust (stable), Node 22; Linux da: `sudo apt install libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`.

```bash
npm run tauri:dev                                         # lokal backend bilan
VITE_API_URL=https://sevento.example.uz npm run tauri:build   # o'rnatish paketlari
```

Server manzili buildga yoziladi: desktop faqat shu serverga ulanadi (Tauri ruxsatlari va CSP shundan yaratiladi).
Refresh token desktopda ham JS ga ko'rinmaydi — Rust tomonidagi cookie jarida saqlanadi. Batafsil: [docs/architecture.md](docs/architecture.md#8-pwa-va-tauri-9-bosqich-).
GitHub Actions: `desktop.yml` (teg `v*` yoki qo'lda) Linux, Windows, macOS paketlarini yig'adi.

## Qoidalar (qisqacha)

- API so'rovlari faqat `features/*/api/` da, TanStack Query hooklari orqali; komponentda `fetch` yo'q.
- API turlari qo'lda yozilmaydi — `schema.d.ts` generatsiya, `src/shared/api/types.ts` faqat alias.
- Access token faqat xotirada; refresh httpOnly cookie da; sahifa yangilanganda `POST /auth/refresh/` bilan tiklanadi.
- Boshqa feature faqat `@/features/<nom>` (index.ts) orqali; `shared/` features ni import qilmaydi (ESLint tekshiradi).
- Matnlar `src/shared/i18n/locales/uz/*.json` da; kodda qattiq matn yo'q.
- WebSocket faqat bildirishnoma kanali: xabar → `src/shared/realtime/invalidation.ts` xaritasi → TanStack kesh invalidate; ma'lumot doim REST dan. Uzilganda `meta.pollWhenOffline` so'rovlar har 30 s qayta o'qiladi.
