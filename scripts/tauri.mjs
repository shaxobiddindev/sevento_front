#!/usr/bin/env node
/**
 * `npm run tauri -- <buyruq>` — Tauri CLI o'rami. Server manzili bitta joydan (VITE_API_URL):
 *  - frontend uni `env.apiBase` sifatida ishlatadi (desktop da nisbiy manzil bo'lmaydi);
 *  - Rust (`SEVENTO_API_URL`) auth so'rovlarini faqat shu serverga yuboradi;
 *  - plugin-http ruxsati (capability) va CSP `connect-src` faqat shu server va uning WebSocket i.
 * Natija: src-tauri/tauri.env.conf.json (gitignore) → `tauri <buyruq> --config ...`.
 *
 *   VITE_API_URL=https://sevento.example.uz npm run tauri:build
 *   npm run tauri:dev            # default: http://localhost:8000
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const cli = require.resolve('@tauri-apps/cli/tauri.js')
const [command = 'help', ...rest] = process.argv.slice(2)

function run(args, env = process.env) {
  const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env, cwd: root })
  process.exit(result.status ?? 1)
}

function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exit(1)
}

if (!['dev', 'build'].includes(command)) run([command, ...rest])

const raw = (process.env.VITE_API_URL || (command === 'dev' ? 'http://localhost:8000' : ''))
  .trim()
  .replace(/\/+$/, '')
if (!raw) {
  fail(
    'Desktop build uchun server manzili kerak: VITE_API_URL=https://sevento.example.uz npm run tauri:build',
  )
}
let api
try {
  api = new URL(raw)
} catch {
  fail(`VITE_API_URL noto'g'ri: ${raw}`)
}
const local = ['localhost', '127.0.0.1'].includes(api.hostname)
if (api.protocol !== 'https:' && !local) {
  fail("Server manzili https bo'lishi kerak (refresh cookie Secure). http faqat localhost uchun.")
}
if (api.pathname !== '/' || api.search) {
  fail("VITE_API_URL — faqat server manzili (yo'lsiz), masalan https://sevento.example.uz")
}
const wsRaw = (
  process.env.VITE_WS_URL || `${api.protocol === 'https:' ? 'wss' : 'ws'}://${api.host}`
)
  .trim()
  .replace(/\/+$/, '')
  .replace(/^http/, 'ws')
const ws = new URL(wsRaw)

const config = {
  app: {
    security: {
      csp: { 'connect-src': `'self' ipc: http://ipc.localhost ${ws.origin}` },
      capabilities: [
        'default',
        {
          identifier: 'http-api',
          description: "API so'rovlari faqat build da berilgan serverga",
          windows: ['main'],
          permissions: [{ identifier: 'http:default', allow: [{ url: `${api.origin}/api/v1/*` }] }],
        },
      ],
    },
  },
}
const configPath = join(root, 'src-tauri', 'tauri.env.conf.json')
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
console.log(`Sevento desktop: server ${api.origin}, WebSocket ${ws.origin}`)

run([command, '--config', configPath, ...rest], {
  ...process.env,
  VITE_API_URL: api.origin,
  VITE_WS_URL: ws.origin,
  SEVENTO_API_URL: api.origin,
})
