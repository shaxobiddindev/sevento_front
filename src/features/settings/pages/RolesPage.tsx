import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import type { Role } from '@/shared/api/types'
import { Badge, Button, DataTable, PageHeader, type Column } from '@/shared/ui'

import { useRoles } from '../api/roles.api'

export function RolesPage() {
  const { t } = useTranslation('settings')
  const navigate = useNavigate()
  const roles = useRoles()

  const columns: Column<Role>[] = [
    {
      key: 'name',
      header: t('roles.name'),
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: 'code',
      header: t('roles.code'),
      render: (r) => <code className="text-xs">{r.code}</code>,
    },
    {
      key: 'capabilities',
      header: t('roles.capabilities'),
      render: (r) => <span className="text-slate-600">{(r.capabilities ?? []).length}</span>,
    },
    { key: 'users_count', header: t('roles.usersCount') },
    {
      key: 'is_system',
      header: '',
      render: (r) => (r.is_system ? <Badge tone="info">{t('roles.system')}</Badge> : null),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('roles.title')}
        actions={
          <Button
            icon={<Plus className="size-4" />}
            onClick={() => navigate('/settings/roles/new')}
          >
            {t('roles.new')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={roles.data}
        rowKey={(r) => r.id}
        loading={roles.isFetching}
        onRowClick={(r) => navigate(`/settings/roles/${r.id}`)}
      />
    </div>
  )
}
