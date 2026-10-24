import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import type { User } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDateTime } from '@/shared/lib/date'
import {
  ActiveBadge,
  Badge,
  Button,
  DataTable,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  type Column,
} from '@/shared/ui'

import { useRoles } from '../api/roles.api'
import { useUsers } from '../api/users.api'

export function UsersPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const { params, page, set, setPage } = useListParams()
  const roles = useRoles()
  const users = useUsers({
    page,
    search: params.search,
    role: params.role,
    is_active: params.is_active,
  })

  const columns: Column<User>[] = [
    {
      key: 'username',
      header: t('users.username'),
      render: (u) => <span className="font-medium">{u.username}</span>,
    },
    { key: 'full_name', header: t('users.fullName') },
    { key: 'phone', header: t('users.phone'), render: (u) => u.phone || '—' },
    {
      key: 'role',
      header: t('users.role'),
      render: (u) =>
        u.role_detail ? (
          <Badge tone="brand">{u.role_detail.name}</Badge>
        ) : (
          <span className="text-slate-400">{t('users.noRole')}</span>
        ),
    },
    {
      key: 'branches',
      header: t('users.branches'),
      render: (u) =>
        u.branches.length ? (
          <span className="text-slate-600">{u.branches.map((b) => b.code).join(', ')}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'last_login',
      header: t('users.lastLogin'),
      render: (u) =>
        u.last_login ? (
          formatDateTime(u.last_login)
        ) : (
          <span className="text-slate-400">{t('users.neverLoggedIn')}</span>
        ),
    },
    {
      key: 'is_active',
      header: tc('fields.isActive'),
      render: (u) => <ActiveBadge active={u.is_active} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => navigate('/settings/users/new')}
          >
            {t('users.new')}
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('users.searchPlaceholder')}
          className="w-full sm:w-72"
        />
        <Select
          value={params.role ?? ''}
          onChange={(e) => set({ role: e.target.value })}
          className="w-full sm:w-48"
        >
          <option value="">{t('users.filterRole')}</option>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select
          value={params.is_active ?? ''}
          onChange={(e) => set({ is_active: e.target.value })}
          className="w-full sm:w-40"
        >
          <option value="">{t('users.filterActive')}</option>
          <option value="true">{tc('status.active')}</option>
          <option value="false">{tc('status.inactive')}</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={users.data?.results}
        rowKey={(u) => u.id}
        loading={users.isFetching}
        onRowClick={(u) => navigate(`/settings/users/${u.id}`)}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={users.data?.total_pages ?? 1}
          count={users.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
      <p className="sr-only">
        <Link to="/settings/users/new">{t('users.new')}</Link>
      </p>
    </div>
  )
}
