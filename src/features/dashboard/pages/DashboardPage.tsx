import { Building2, ScrollText, ShieldCheck, Users } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { Card, PageHeader, PageSpinner } from '@/shared/ui'

// Savdo moduli va grafiklar (recharts) alohida chunk da: boshlang'ich sahifa yengil qolsin
const TodaySales = lazy(() => import('@/features/sales').then((m) => ({ default: m.TodaySales })))
const ExecutiveDashboard = lazy(() => import('../components/ExecutiveDashboard'))

export function DashboardPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const canUsers = useCapability('users.manage')
  const canBranches = useCapability('branches.manage')
  const canAudit = useCapability('audit.view')
  const canSales = useCapability('sales.view')
  const canDashboard = useCapability('dashboard.view')

  if (!user) return null

  const links = [
    canUsers && { to: '/settings/users', label: t('nav:users'), icon: Users },
    canBranches && { to: '/settings/branches', label: t('nav:branches'), icon: Building2 },
    canUsers && { to: '/settings/roles', label: t('nav:roles'), icon: ShieldCheck },
    canAudit && { to: '/audit', label: t('nav:audit'), icon: ScrollText },
  ].filter(Boolean) as { to: string; label: string; icon: typeof Users }[]

  return (
    <div>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.welcome', { name: user.full_name })}
      />
      {canDashboard ? (
        // rahbar: ko'rsatkichlar va grafiklar (savdoda jonli yangilanadi)
        <Suspense fallback={<PageSpinner />}>
          <ExecutiveDashboard />
        </Suspense>
      ) : (
        <>
          {canSales && (
            <div className="mb-4">
              <Suspense fallback={null}>
                <TodaySales />
              </Suspense>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                {t('dashboard.role')}
              </p>
              <p className="mt-1 text-lg font-semibold">{user.role?.name ?? '—'}</p>
            </Card>
            <Card>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                {t('dashboard.branches')}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {user.all_branches
                  ? t('branch.all')
                  : user.branches.map((b) => b.name).join(', ') || '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                {t('dashboard.capabilities')}
              </p>
              <p className="mt-1 text-lg font-semibold">{user.capabilities.length}</p>
            </Card>
          </div>
        </>
      )}
      {links.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('dashboard.quickLinks')}</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-400 hover:bg-brand-50/40"
              >
                <Icon className="size-5 text-brand-700" />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
