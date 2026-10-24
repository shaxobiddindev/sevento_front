import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

import { Button } from '@/shared/ui'

const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Service worker ro'yxatdan o'tkazish va yangi versiya haqida xabar. Yangilash faqat foydalanuvchi
 * bosganda (kassir savdo o'rtasida bo'lsa sahifa o'zi qayta yuklanmaydi). Tauri da bu modul
 * bo'sh (no-op) — vite.config dagi `disable`.
 */
export function PwaUpdater() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // uzoq ochiq turadigan kassa oynalari ham yangi versiyani topsin
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS)
    },
  })
  if (!needRefresh) return null

  const update = () => {
    // workbox-window faqat sahifa ochilishida SW nazoratida bo'lganda o'zi qayta yuklaydi;
    // birinchi tashrif sessiyasida ham yangi versiya faollashishi bilan sahifa yangilansin
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    })
    void updateServiceWorker(true)
  }
  return (
    <div
      role="alertdialog"
      aria-labelledby="pwa-update-title"
      data-testid="pwa-update"
      className="fixed right-4 bottom-4 z-[90] w-[calc(100%-2rem)] max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <p id="pwa-update-title" className="text-sm font-semibold">
            {t('pwa.updateTitle')}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">{t('pwa.updateText')}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={update}>
              {t('pwa.update')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              {t('pwa.later')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
