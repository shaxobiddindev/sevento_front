import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Dev rejimida /api va /ws backend ga proxy qilinadi — shunda frontend va backend bitta
// origin da ishlaydi (refresh cookie SameSite=Strict bilan ishlaydi, CORS kerak emas).
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000'

// `tauri dev/build` TAURI_ENV_* o'zgaruvchilarini beradi: desktop da service worker kerak emas
// (ilova fayllari o'rnatilgan paket ichida), virtual modul esa bo'sh (no-op) bo'lib qoladi.
const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM)

// Faqat ilova qobig'i (HTML, JS, CSS, ikonkalar) keshlanadi. API javoblari, fayllar, WebSocket
// hech qachon keshlanmaydi — ma'lumot manbai doim server (oflayn rejimda "Internet yo'q" ekrani).
const pwa = VitePWA({
  disable: isTauri,
  registerType: 'prompt',
  injectRegister: false,
  manifest: {
    id: '/',
    name: 'Sevento — savdo va ombor',
    short_name: 'Sevento',
    description: 'Savdo, ombor, nasiya va kassa boshqaruvi (bir nechta savdo nuqtasi)',
    lang: 'uz',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#0f766e',
    background_color: '#f8fafc',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Kassa (POS)',
        url: '/sales/pos',
        icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }],
      },
      {
        name: 'Qoldiq',
        url: '/inventory/stock',
        icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }],
      },
      {
        name: 'Hisobotlar',
        url: '/reports',
        icons: [{ src: '/icons/pwa-192.png', sizes: '192x192' }],
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallback: '/index.html',
    // backend yo'llari SPA ga aylanib qolmasin (Nginx ularni backend ga uzatadi)
    navigateFallbackDenylist: [/^\/api\//, /^\/ws\//, /^\/admin\//, /^\/static\//, /^\/media\//],
    runtimeCaching: [],
    cleanupOutdatedCaches: true,
    // birinchi tashrifdagi sahifa ham SW nazoratiga o'tadi — aks holda shu sessiyada chiqqan
    // yangi versiyada «Yangilash» bosilganda controllerchange bo'lmaydi va sahifa yangilanmaydi
    clientsClaim: true,
    // yangi versiya faqat foydalanuvchi «Yangilash» ni bosganda faollashadi (prompt)
    skipWaiting: false,
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), pwa],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: proxyTarget, changeOrigin: false },
      '/ws': { target: proxyTarget.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
