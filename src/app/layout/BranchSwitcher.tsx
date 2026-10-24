import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/features/auth'
import { Select } from '@/shared/ui'

/** Joriy nuqta. Bitta nuqta bo'lsa tanlagich o'rniga nomi ko'rsatiladi. */
export function BranchSwitcher() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const currentBranchId = useAuthStore((s) => s.currentBranchId)
  const setCurrentBranch = useAuthStore((s) => s.setCurrentBranch)

  if (!user) return null
  const branches = user.branches
  if (!branches.length) return null

  if (branches.length === 1 && !user.all_branches) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
        <Building2 className="size-4" />
        {branches[0].name}
      </span>
    )
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
      <Building2 className="size-4" />
      <Select
        value={currentBranchId ?? ''}
        onChange={(e) => setCurrentBranch(e.target.value ? Number(e.target.value) : null)}
        className="h-9 w-48"
        aria-label={t('branch.select')}
      >
        {user.all_branches && <option value="">{t('branch.all')}</option>}
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
    </label>
  )
}
