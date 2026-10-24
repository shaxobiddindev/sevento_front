import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import type { User } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import {
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageSpinner,
  Select,
  Switch,
  toast,
} from '@/shared/ui'

import { useAllBranches } from '../api/branches.api'
import { useRoles } from '../api/roles.api'
import { useCreateUser, useSetUserPassword, useUpdateUser, useUser } from '../api/users.api'

const schema = z.object({
  username: z.string().trim().min(1).max(150),
  password: z.string().optional(),
  full_name: z.string().trim().min(1).max(150),
  phone: z.string().trim().max(30),
  role: z.string(),
  branch_ids: z.array(z.number()),
  default_branch_id: z.number().nullable(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

const FIELDS = [
  'username',
  'password',
  'full_name',
  'phone',
  'role',
  'branch_ids',
  'default_branch_id',
  'is_active',
] as const

function toFormValues(user?: User): FormValues {
  return {
    username: user?.username ?? '',
    password: '',
    full_name: user?.full_name ?? '',
    phone: user?.phone ?? '',
    role: user?.role ? String(user.role) : '',
    branch_ids: user?.branches.map((b) => b.id) ?? [],
    default_branch_id: user?.branches.find((b) => b.is_default)?.id ?? null,
    is_active: user?.is_active ?? true,
  }
}

export function UserFormPage() {
  const { id } = useParams()
  const isNew = id === undefined
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()

  const user = useUser(isNew ? undefined : id)
  const roles = useRoles()
  const branches = useAllBranches()
  const create = useCreateUser()
  const update = useUpdateUser(id ?? '')
  const [passwordOpen, setPasswordOpen] = useState(false)

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues() })
  const { register, handleSubmit, control, reset, setError, setValue, formState } = form

  useEffect(() => {
    if (user.data) reset(toFormValues(user.data))
  }, [user.data, reset])

  const branchIds = useWatch({ control, name: 'branch_ids' })
  const defaultBranch = useWatch({ control, name: 'default_branch_id' })
  useEffect(() => {
    if (defaultBranch !== null && !branchIds.includes(defaultBranch)) {
      setValue('default_branch_id', null)
    } else if (defaultBranch === null && branchIds.length === 1) {
      setValue('default_branch_id', branchIds[0])
    }
  }, [branchIds, defaultBranch, setValue])

  const onSubmit = (values: FormValues) => {
    if (isNew && !values.password) {
      setError('password', { message: tc('validation:required') })
      return
    }
    const body = {
      username: values.username,
      full_name: values.full_name,
      phone: values.phone,
      role: values.role ? Number(values.role) : null,
      branch_ids: values.branch_ids,
      default_branch_id: values.default_branch_id,
      is_active: values.is_active,
      ...(values.password ? { password: values.password } : {}),
    }
    const onError = (error: unknown) => applyServerErrors(error, setError, FIELDS)
    if (isNew) {
      create.mutate(body as Parameters<typeof create.mutate>[0], {
        onSuccess: (created) => {
          toast.success(t('users.created'))
          navigate(`/settings/users/${created.id}`, { replace: true })
        },
        onError,
      })
    } else {
      update.mutate(body, {
        onSuccess: () => toast.success(t('users.updated')),
        onError,
      })
    }
  }

  if (!isNew && user.isPending) return <PageSpinner />

  const saving = create.isPending || update.isPending

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isNew ? t('users.new') : t('users.edit')}
        subtitle={user.data ? `${user.data.full_name} (${user.data.username})` : undefined}
        actions={
          <>
            {!isNew && (
              <Button
                variant="secondary"
                icon={<KeyRound className="size-4" />}
                onClick={() => setPasswordOpen(true)}
              >
                {t('users.setPassword')}
              </Button>
            )}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/settings/users')}
            >
              {tc('actions.back')}
            </Button>
          </>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t('users.username')}
              required
              error={formState.errors.username?.message}
            >
              <Input
                autoComplete="off"
                {...register('username')}
                invalid={!!formState.errors.username}
              />
            </FormField>
            <FormField
              label={t('users.fullName')}
              required
              error={formState.errors.full_name?.message}
            >
              <Input {...register('full_name')} invalid={!!formState.errors.full_name} />
            </FormField>
            <FormField label={t('users.phone')} error={formState.errors.phone?.message}>
              <Input placeholder="+998 90 123 45 67" {...register('phone')} />
            </FormField>
            <FormField label={t('users.role')} error={formState.errors.role?.message}>
              <Select {...register('role')}>
                <option value="">{t('users.noRole')}</option>
                {roles.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {isNew && (
              <FormField
                label={t('users.password')}
                required
                hint={t('users.passwordHint')}
                error={formState.errors.password?.message}
              >
                <Input type="password" autoComplete="new-password" {...register('password')} />
              </FormField>
            )}
          </div>

          <FormField
            label={t('users.branches')}
            error={formState.errors.branch_ids?.message}
            hint={t('users.allBranches')}
          >
            <Controller
              control={control}
              name="branch_ids"
              render={({ field }) => (
                <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {branches.data?.map((b) => {
                    const checked = field.value.includes(b.id)
                    return (
                      <div key={b.id} className="flex items-center justify-between px-3 py-2">
                        <Checkbox
                          label={`${b.name} (${b.code})`}
                          checked={checked}
                          onChange={(e) =>
                            field.onChange(
                              e.target.checked
                                ? [...field.value, b.id]
                                : field.value.filter((x) => x !== b.id),
                            )
                          }
                        />
                        {checked && (
                          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                            <input
                              type="radio"
                              name="default_branch"
                              checked={defaultBranch === b.id}
                              onChange={() =>
                                setValue('default_branch_id', b.id, { shouldDirty: true })
                              }
                              className="size-3.5 text-brand-700 focus:ring-brand-500"
                            />
                            {t('users.defaultBranch')}
                          </label>
                        )}
                      </div>
                    )
                  })}
                  {branches.data?.length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-400">{tc('status.empty')}</p>
                  )}
                </div>
              )}
            />
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

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => navigate('/settings/users')}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {isNew ? tc('actions.create') : tc('actions.save')}
            </Button>
          </div>
        </Card>
      </form>

      {!isNew && id && (
        <SetPasswordModal userId={id} open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      )}
    </div>
  )
}

const passwordSchema = z.object({ new_password: z.string().min(8) })
type PasswordValues = z.infer<typeof passwordSchema>

function SetPasswordModal({
  userId,
  open,
  onClose,
}: {
  userId: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation()
  const mutation = useSetUserPassword(userId)
  const { register, handleSubmit, reset, setError, formState } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  })
  const close = () => {
    reset()
    onClose()
  }
  const onSubmit = (values: PasswordValues) =>
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(t('users.passwordSet'))
        close()
      },
      onError: (error) => applyServerErrors(error, setError, ['new_password']),
    })
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('users.setPassword')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="set-password-form" loading={mutation.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id="set-password-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label={t('users.newPassword')}
          hint={t('users.passwordHint')}
          error={formState.errors.new_password?.message}
        >
          <Input type="password" autoComplete="new-password" {...register('new_password')} />
        </FormField>
      </form>
    </Modal>
  )
}
