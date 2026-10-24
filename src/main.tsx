import '@/shared/i18n'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { isDesktop } from './shared/platform'

async function start() {
  // Desktop (Tauri) moslamalari faqat Tauri ichida yuklanadi — veb/PWA bundle ga kirmaydi
  if (isDesktop()) {
    const { installDesktop } = await import('./shared/platform/desktop')
    installDesktop()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
