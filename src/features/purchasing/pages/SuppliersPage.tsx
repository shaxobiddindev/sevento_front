import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useCapability } from '@/features/auth'
import type { Supplier } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { useListParams } from '@/shared/hooks/useListParams'
import {
  ActiveBadge,
  Button,
  DataTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Switch,
  Textarea,
  toast,
  type Column,
} from '@/shared/ui'

import { useSaveSupplier, useSuppliers } from '../api/purchasing.api'

export function SuppliersPage() {
  const { t } = useTranslation('purchasing')
  const { t: tc } = useTranslation()
  const canManage = useCapability('purchasing.manage')
  const { params, page, set, setPage } = useListParams()
  const suppliers = useSuppliers({ page, search: params.search })
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: t('suppliers.name'),
      render: (s) => <span className="font-medium">{s.name}</span>,
    },
    { key: 'phone', header: t('suppliers.phone'), render: (s) => s.phone || '—' },
    {
      key: 'contact',
      header: t('suppliers.contactPerson'),
      render: (s) => s.contact_person || '—',
    },
    { key: 'tin', header: t('suppliers.tin'), render: (s) => s.tin || '—' },
    { key: 'count', header: t('suppliers.purchasesCount'), render: (s) => s.purchases_count ?? 0 },
    {
      key: 'active',
      header: tc('fields.isActive'),
      render: (s) => <ActiveBadge active={s.is_active ?? true} />,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('suppliers.title')}
        actions={
          canManage && (
            <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              {t('suppliers.new')}
            </Button>
          )
        }
      />
      <div className="mb-3">
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('suppliers.searchPlaceholder')}
          className="w-full sm:w-80"
        />
      </div>
      <DataTable
        columns={columns}
        rows={suppliers.data?.results}
        rowKey={(s) => s.id}
        loading={suppliers.isFetching}
        onRowClick={canManage ? setEditing : undefined}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={suppliers.data?.total_pages ?? 1}
          count={suppliers.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
      <SupplierModal
        supplier={editing && editing !== 'new' ? editing : undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(30),
  contact_person: z.string().trim().max(150),
  tin: z.string().trim().max(20),
  address: z.string().trim().max(255),
  note: z.string(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>

function SupplierModal({
  supplier,
  open,
  onClose,
}: {
  supplier?: Supplier
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('purchasing')
  const { t: tc } = useTranslation()
  const save = useSaveSupplier()
  const { register, handleSubmit, control, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: open
      ? {
          name: supplier?.name ?? '',
          phone: supplier?.phone ?? '',
          contact_person: supplier?.contact_person ?? '',
          tin: supplier?.tin ?? '',
          address: supplier?.address ?? '',
          note: supplier?.note ?? '',
          is_active: supplier?.is_active ?? true,
        }
      : undefined,
  })

  const onSubmit = (values: FormValues) =>
    save.mutate(
      { id: supplier?.id, body: values },
      {
        onSuccess: () => {
          toast.success(t('suppliers.saved'))
          onClose()
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(schema.shape)),
      },
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={supplier ? t('suppliers.edit') : t('suppliers.new')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="supplier-form" loading={save.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label={t('suppliers.name')} required error={formState.errors.name?.message}>
          <Input autoFocus {...register('name')} invalid={!!formState.errors.name} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t('suppliers.phone')} error={formState.errors.phone?.message}>
            <Input {...register('phone')} placeholder="+998 90 123 45 67" />
          </FormField>
          <FormField label={t('suppliers.tin')} error={formState.errors.tin?.message}>
            <Input {...register('tin')} inputMode="numeric" />
          </FormField>
        </div>
        <FormField
          label={t('suppliers.contactPerson')}
          error={formState.errors.contact_person?.message}
        >
          <Input {...register('contact_person')} />
        </FormField>
        <FormField label={t('suppliers.address')} error={formState.errors.address?.message}>
          <Input {...register('address')} />
        </FormField>
        <FormField label={t('suppliers.note')}>
          <Textarea rows={2} {...register('note')} />
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
