import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { WriteOffReason } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import {
  ActiveBadge,
  Badge,
  Button,
  DataTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  Switch,
  toast,
  type Column,
} from '@/shared/ui'

import { useSaveWriteOffReason, useWriteOffReasons } from '../api/documents.api'

/** Hisobdan chiqarish sabablari — MB ma'lumotnomasi (kodda emas). */
export function WriteOffReasonsPage() {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const reasons = useWriteOffReasons()
  const [editing, setEditing] = useState<WriteOffReason | 'new' | null>(null)

  const columns: Column<WriteOffReason>[] = [
    { key: 'code', header: t('reasons.code'), render: (r) => <code>{r.code}</code> },
    {
      key: 'name',
      header: t('reasons.name'),
      render: (r) => (
        <span>
          {r.name}
          {r.is_system && (
            <Badge tone="info" className="ml-2">
              {t('reasons.system')}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'active',
      header: tc('fields.isActive'),
      render: (r) => <ActiveBadge active={r.is_active ?? true} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (r) =>
        !r.is_system && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Pencil className="size-4" />}
            onClick={() => setEditing(r)}
            aria-label={tc('actions.edit')}
          />
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('reasons.title')}
        subtitle={t('reasons.systemHint')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('reasons.new')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={reasons.data}
        rowKey={(r) => r.id}
        loading={reasons.isFetching}
      />
      <ReasonFormModal
        reason={editing && editing !== 'new' ? editing : undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

const schema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(100),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function ReasonFormModal({
  reason,
  open,
  onClose,
}: {
  reason?: WriteOffReason
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const save = useSaveWriteOffReason()
  const { register, handleSubmit, control, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: open
      ? { code: reason?.code ?? '', name: reason?.name ?? '', is_active: reason?.is_active ?? true }
      : undefined,
  })

  const onSubmit = (values: FormValues) =>
    save.mutate(
      { id: reason?.id, body: values },
      {
        onSuccess: () => {
          toast.success(t('reasons.saved'))
          onClose()
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(schema.shape)),
      },
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={reason ? t('reasons.edit') : t('reasons.new')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="write-off-reason-form" loading={save.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form
        id="write-off-reason-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('reasons.code')} required error={formState.errors.code?.message}>
            <Input {...register('code')} />
          </FormField>
          <FormField label={t('reasons.name')} required error={formState.errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
        </div>
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
