import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import { useCapabilities } from '@/features/auth'
import type { Capability, Role } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  FormField,
  Input,
  PageHeader,
  PageSpinner,
  toast,
} from '@/shared/ui'

import { useCreateRole, useDeleteRole, useRole, useUpdateRole } from '../api/roles.api'

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_-]+$/i, { message: 'slug' }),
  name: z.string().trim().min(1).max(100),
  capabilities: z.array(z.string()),
})
type FormValues = z.infer<typeof schema>

function toFormValues(role?: Role): FormValues {
  return { code: role?.code ?? '', name: role?.name ?? '', capabilities: role?.capabilities ?? [] }
}

export function RoleFormPage() {
  const { id } = useParams()
  const isNew = id === undefined
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()

  const role = useRole(isNew ? undefined : id)
  const capabilities = useCapabilities()
  const create = useCreateRole()
  const update = useUpdateRole(id ?? '')
  const remove = useDeleteRole()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { register, handleSubmit, control, reset, setError, setValue, formState } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: toFormValues(),
    })

  useEffect(() => {
    if (role.data) reset(toFormValues(role.data))
  }, [role.data, reset])

  const groups = useMemo(() => {
    const map = new Map<string, Capability[]>()
    for (const cap of capabilities.data ?? []) {
      const list = map.get(cap.group) ?? []
      list.push(cap)
      map.set(cap.group, list)
    }
    return [...map.entries()]
  }, [capabilities.data])

  const selected = useWatch({ control, name: 'capabilities' })
  const isSystem = role.data?.is_system ?? false

  const onSubmit = (values: FormValues) => {
    const onError = (error: unknown) =>
      applyServerErrors(error, setError, ['code', 'name', 'capabilities'])
    if (isNew) {
      create.mutate(values, {
        onSuccess: (created) => {
          toast.success(t('roles.created'))
          navigate(`/settings/roles/${created.id}`, { replace: true })
        },
        onError,
      })
    } else {
      const body = isSystem ? { name: values.name, capabilities: values.capabilities } : values
      update.mutate(body, { onSuccess: () => toast.success(t('roles.updated')), onError })
    }
  }

  const onDelete = () =>
    remove.mutate(id!, {
      onSuccess: () => {
        toast.success(t('roles.deleted'))
        navigate('/settings/roles', { replace: true })
      },
      onError: (error) => {
        setConfirmDelete(false)
        toast.error(error.message)
      },
    })

  if (!isNew && role.isPending) return <PageSpinner />

  const codeError =
    formState.errors.code?.message === 'slug'
      ? tc('validation:slug')
      : formState.errors.code?.message

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={isNew ? t('roles.new') : t('roles.edit')}
        subtitle={role.data?.name}
        actions={
          <>
            {!isNew && !isSystem && (
              <Button
                variant="danger"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConfirmDelete(true)}
              >
                {tc('actions.delete')}
              </Button>
            )}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/settings/roles')}
            >
              {tc('actions.back')}
            </Button>
          </>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('roles.name')} required error={formState.errors.name?.message}>
              <Input {...register('name')} invalid={!!formState.errors.name} />
            </FormField>
            <FormField
              label={t('roles.code')}
              required
              hint={isSystem ? undefined : t('roles.codeHint')}
              error={codeError}
            >
              <div className="flex items-center gap-2">
                <Input
                  {...register('code')}
                  disabled={isSystem}
                  invalid={!!formState.errors.code}
                />
                {isSystem && <Badge tone="info">{t('roles.system')}</Badge>}
              </div>
            </FormField>
          </div>

          <FormField
            label={`${t('roles.capabilities')} — ${t('roles.selected', { count: selected.length })}`}
            error={formState.errors.capabilities?.message}
          >
            <div className="mb-2 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setValue('capabilities', capabilities.data?.map((c) => c.code) ?? [], {
                    shouldDirty: true,
                  })
                }
              >
                {t('roles.selectAll')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setValue('capabilities', [], { shouldDirty: true })}
              >
                {t('roles.clearAll')}
              </Button>
            </div>
            <Controller
              control={control}
              name="capabilities"
              render={({ field }) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map(([group, caps]) => (
                    <div key={group} className="rounded-md border border-slate-200 p-3">
                      <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        {group}
                      </p>
                      <div className="space-y-1.5">
                        {caps.map((cap) => (
                          <Checkbox
                            key={cap.code}
                            label={cap.name}
                            checked={field.value.includes(cap.code)}
                            onChange={(e) =>
                              field.onChange(
                                e.target.checked
                                  ? [...field.value, cap.code]
                                  : field.value.filter((c) => c !== cap.code),
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            />
          </FormField>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button variant="secondary" onClick={() => navigate('/settings/roles')}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" loading={create.isPending || update.isPending}>
              {isNew ? tc('actions.create') : tc('actions.save')}
            </Button>
          </div>
        </Card>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        text={t('roles.deleteConfirm', { name: role.data?.name })}
        loading={remove.isPending}
        onConfirm={onDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  )
}
