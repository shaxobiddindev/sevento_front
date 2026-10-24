import { KeyRound, LogOut, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'

import { ChangePasswordModal, useAuthStore } from '@/features/auth'
import { cn } from '@/shared/lib/cn'
import { Button, toast } from '@/shared/ui'

import { BranchSwitcher } from './BranchSwitcher'
import { ConnectionIndicator, OfflineBanner } from './ConnectionIndicator'
import { activeNavPath, filterNav, navItems } from './nav'
import { useNavBadges } from './useNavBadges'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const items = filterNav(navItems, user?.capabilities ?? [])
  const { pathname } = useLocation()
  const activePath = activeNavPath(pathname, items)
  // qabul qiluvchi nuqtaga: kutilayotgan ko'chirishlar soni (transfer.* xabari bilan yangilanadi)
  const badges = useNavBadges()

  const onLogout = async () => {
    await logout()
    toast.info(t('auth:loggedOut'))
    navigate('/login', { replace: true })
  }

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map((item) =>
        item.children ? (
          <div key={item.labelKey} className="pt-3">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              {t(`nav:${item.labelKey}`)}
            </p>
            {item.children.map((child) => (
              <NavItemLink
                key={child.to}
                to={child.to!}
                active={child.to === activePath}
                icon={child.icon}
                label={t(`nav:${child.labelKey}`)}
                badge={child.badge ? badges[child.badge] : 0}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>
        ) : (
          <NavItemLink
            key={item.to}
            to={item.to!}
            active={item.to === activePath}
            icon={item.icon}
            label={t(`nav:${item.labelKey}`)}
            onClick={() => setMobileOpen(false)}
          />
        ),
      )}
    </nav>
  )

  const userBlock = (
    <div className="border-t border-slate-800 p-3">
      <p className="truncate text-sm font-medium text-white">{user?.full_name}</p>
      <p className="truncate text-xs text-slate-400">{user?.role?.name ?? user?.username}</p>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <Button
          size="sm"
          variant="sidebar"
          className="justify-start"
          icon={<KeyRound className="size-4" />}
          onClick={() => setPasswordOpen(true)}
          title={t('nav:changePassword')}
        >
          {t('nav:password')}
        </Button>
        <Button
          size="sm"
          variant="sidebar"
          className="justify-start"
          icon={<LogOut className="size-4" />}
          onClick={onLogout}
          aria-label={t('actions.logout')}
        >
          {t('actions.logout')}
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 text-slate-200 lg:flex">
        <div className="flex h-14 items-center gap-2 px-4 text-lg font-bold text-white">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600">S</span>
          {t('app')}
        </div>
        {nav}
        {userBlock}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-slate-900 text-slate-200 shadow-xl">
            <div className="flex h-14 items-center justify-between px-4 text-lg font-bold text-white">
              {t('app')}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded p-1 hover:bg-slate-800"
                aria-label={t('actions.close')}
              >
                <X className="size-5" />
              </button>
            </div>
            {nav}
            {userBlock}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4">
          <button
            type="button"
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />
          <ConnectionIndicator />
          <BranchSwitcher />
        </header>
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}

function NavItemLink({
  to,
  active,
  icon: Icon,
  label,
  badge = 0,
  onClick,
}: {
  to: string
  active: boolean
  icon: typeof Menu
  label: string
  badge?: number
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span
          className="rounded-full bg-sky-500 px-1.5 text-xs font-semibold text-white"
          data-testid="nav-badge"
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
