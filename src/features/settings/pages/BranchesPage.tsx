import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useCapability } from '@/features/auth'
import type { Branch } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { useListParams } from '@/shared/hooks/useListParams'
import {
  ActiveBadge,
  Badge,
  Button,
  DataTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Switch,
  toast,
  type Column,
} from '@/shared/ui'

import { useBranches, useCreateBranch, useUpdateBranch } from '../api/branches.api'

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[a-z0-9]+$/i, { message: 'alnum' }),
  name: z.string().trim().min(1).max(100),
  type: z.enum(['shop', 'warehouse']),
  address: z.string().trim().max(255),
  phone: z.string().trim().max(30),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function toFormValues(branch?: Branch): FormValues {
  return {
    code: branch?.code ?? '',
    name: branch?.name ?? '',
    type: branch?.type ?? 'shop',
    address: branch?.address ?? '',
    phone: branch?.phone ?? '',
    is_active: branch?.is_active ?? true,
  }
}

export function BranchesPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation()
  const canManage = useCapability('branches.manage')
  const { params, page, set, setPage } = useListParams()
  const branches = useBranches({ page, search: params.search, type: params.type })
  const [editing, setEditing] = useState<Branch | null | 'new'>(null)

  const columns: Column<Branch>[] = [
    {
      key: 'code',
      header: t('branches.code'),
      render: (b) => <code className="text-xs font-semibold">{b.code}</code>,
    },
    {
      key: 'name',
      header: t('branches.name'),
      render: (b) => <span className="font-medium">{b.name}</span>,
    },
    {
      key: 'type',
      header: t('branches.type'),
      render: (b) => (
        <Badge tone={b.type === 'shop' ? 'brand' : 'info'}>{tc(`branch.${b.type}`)}</Badge>
      ),
    },
    { key: 'phone', header: tc('fields.phone'), render: (b) => b.phone || '—' },
    { key: 'address', header: tc('fields.address'), render: (b) => b.address || '—' },
    {
      key: 'is_active',
      header: tc('fields.isActive'),
      render: (b) => <ActiveBadge active={b.is_active ?? true} />,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'text-right',
            render: (b: Branch) => (
              <Button
                size="sm"
                variant="ghost"
                icon={<Pencil className="size-4" />}
                onClick={() => setEditing(b)}
                aria-label={tc('actions.edit')}
              />
            ),
          } satisfies Column<Branch>,
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        title={t('branches.title')}
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('branches.new')}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          className="w-full sm:w-72"
        />
        <Select
          value={params.type ?? ''}
          onChange={(e) => set({ type: e.target.value })}
          className="w-full sm:w-40"
        >
          <option value="">{tc('fields.type')}</option>
          <option value="shop">{tc('branch.shop')}</option>
          <option value="warehouse">{tc('branch.warehouse')}</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={branches.data?.results}
        rowKey={(b) => b.id}
        loading={branches.isFetching}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={branches.data?.total_pages ?? 1}
          count={branches.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
      <BranchFormModal
        branch={editing === 'new' ? undefined : (editing ?? undefined)}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function BranchFormModal({
  branch,
  open,
  onClose,
}: {
  branch?: Branch
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation()
  const create = useCreateBranch()
  const update = useUpdateBranch()
  const { register, handleSubmit, control, reset, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(branch),
  })

  useEffect(() => {
    if (open) reset(toFormValues(branch))
  }, [open, branch, reset])

  const onSubmit = (values: FormValues) => {
    const body = { ...values, code: values.code.toUpperCase() }
    const onError = (error: unknown) => applyServerErrors(error, setError, Object.keys(values))
    if (branch) {
      update.mutate(
        { id: branch.id, body },
        {
          onSuccess: () => {
            toast.success(t('branches.updated'))
            onClose()
          },
          onError,
        },
      )
    } else {
      create.mutate(body, {
        onSuccess: () => {
          toast.success(t('branches.created'))
          onClose()
        },
        onError,
      })
    }
  }

  const codeError =
    formState.errors.code?.message === 'alnum'
      ? tc('validation:alnum')
      : formState.errors.code?.message

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={branch ? t('branches.edit') : t('branches.new')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="branch-form" loading={create.isPending || update.isPending}>
            {branch ? tc('actions.save') : tc('actions.create')}
          </Button>
        </>
      }
    >
      <form id="branch-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t('branches.code')}
            required
            hint={t('branches.codeHint')}
            error={codeError}
          >
            <Input {...register('code')} className="uppercase" invalid={!!formState.errors.code} />
          </FormField>
          <FormField label={t('branches.type')} required error={formState.errors.type?.message}>
            <Select {...register('type')}>
              <option value="shop">{tc('branch.shop')}</option>
              <option value="warehouse">{tc('branch.warehouse')}</option>
            </Select>
          </FormField>
        </div>
        <FormField label={t('branches.name')} required error={formState.errors.name?.message}>
          <Input {...register('name')} invalid={!!formState.errors.name} />
        </FormField>
        <FormField label={tc('fields.phone')} error={formState.errors.phone?.message}>
          <Input {...register('phone')} />
        </FormField>
        <FormField label={tc('fields.address')} error={formState.errors.address?.message}>
          <Input {...register('address')} />
        </FormField>
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch
                checked={field.value}
                onChange={field.onChange}
                label={tc('fields.isActive')}
              />
              <span className="text-sm">{tc('fields.isActive')}</span>
            </div>
          )}
        />
      </form>
    </Modal>
  )
}
