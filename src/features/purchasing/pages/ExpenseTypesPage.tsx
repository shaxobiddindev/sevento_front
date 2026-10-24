import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { ExpenseType } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import {
  ActiveBadge,
  Button,
  DataTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  Select,
  Switch,
  toast,
  type Column,
} from '@/shared/ui'

import { useExpenseTypes, useSaveExpenseType } from '../api/purchasing.api'

export function ExpenseTypesPage() {
  const { t } = useTranslation('purchasing')
  const { t: tc } = useTranslation()
  const types = useExpenseTypes()
  const [editing, setEditing] = useState<ExpenseType | 'new' | null>(null)

  const columns: Column<ExpenseType>[] = [
    { key: 'code', header: t('expenseTypes.code'), render: (e) => <code>{e.code}</code> },
    { key: 'name', header: t('expenseTypes.name') },
    {
      key: 'alloc',
      header: t('expenseTypes.defaultAllocation'),
      render: (e) => t(`allocation.${e.default_allocation ?? 'by_value'}`),
    },
    {
      key: 'active',
      header: tc('fields.isActive'),
      render: (e) => <ActiveBadge active={e.is_active ?? true} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (e) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Pencil className="size-4" />}
          onClick={() => setEditing(e)}
          aria-label={tc('actions.edit')}
        />
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('expenseTypes.title')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('expenseTypes.new')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={types.data}
        rowKey={(e) => e.id}
        loading={types.isFetching}
      />
      <ExpenseTypeModal
        expenseType={editing && editing !== 'new' ? editing : undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

const schema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(100),
  default_allocation: z.enum(['by_value', 'by_quantity']),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function ExpenseTypeModal({
  expenseType,
  open,
  onClose,
}: {
  expenseType?: ExpenseType
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('purchasing')
  const { t: tc } = useTranslation()
  const save = useSaveExpenseType()
  const { register, handleSubmit, control, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: open
      ? {
          code: expenseType?.code ?? '',
          name: expenseType?.name ?? '',
          default_allocation: expenseType?.default_allocation ?? 'by_value',
          is_active: expenseType?.is_active ?? true,
        }
      : undefined,
  })

  const onSubmit = (values: FormValues) =>
    save.mutate(
      { id: expenseType?.id, body: values },
      {
        onSuccess: () => {
          toast.success(t('expenseTypes.saved'))
          onClose()
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(schema.shape)),
      },
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expenseType ? t('expenseTypes.edit') : t('expenseTypes.new')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="expense-type-form" loading={save.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form
        id="expense-type-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('expenseTypes.code')} required error={formState.errors.code?.message}>
            <Input {...register('code')} />
          </FormField>
          <FormField label={t('expenseTypes.name')} required error={formState.errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
        </div>
        <FormField label={t('expenseTypes.defaultAllocation')}>
          <Select {...register('default_allocation')}>
            <option value="by_value">{t('allocation.by_value')}</option>
            <option value="by_quantity">{t('allocation.by_quantity')}</option>
          </Select>
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
