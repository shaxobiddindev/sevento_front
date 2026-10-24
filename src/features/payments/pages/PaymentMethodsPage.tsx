import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { PaymentMethod } from '@/shared/api/types'
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
  Select,
  Switch,
  toast,
  type Column,
} from '@/shared/ui'

import { usePaymentMethods, useSavePaymentMethod } from '../api/payments.api'

const PROVIDERS = ['manual'] as const

/** To'lov turlari (MB da): naqd, terminal, o'tkazma; Click/Payme provayder ulanganda qo'shiladi. */
export function PaymentMethodsPage() {
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const methods = usePaymentMethods()
  const [editing, setEditing] = useState<PaymentMethod | 'new' | null>(null)

  const columns: Column<PaymentMethod>[] = [
    {
      key: 'order',
      header: t('methods.order'),
      className: 'w-16',
      render: (m) => m.sort_order ?? 0,
    },
    { key: 'code', header: t('methods.code'), render: (m) => <code>{m.code}</code> },
    {
      key: 'name',
      header: t('methods.name'),
      render: (m) => (
        <span className="inline-flex items-center gap-2">
          {m.name}
          {m.is_cash && <Badge tone="success">{t('methods.cashShort')}</Badge>}
        </span>
      ),
    },
    {
      key: 'provider',
      header: t('methods.provider'),
      render: (m) => t(`methods.providers.${m.provider ?? 'manual'}`, { defaultValue: m.provider }),
    },
    {
      key: 'active',
      header: tc('fields.isActive'),
      render: (m) => <ActiveBadge active={m.is_active ?? true} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Pencil className="size-4" />}
          onClick={() => setEditing(m)}
          aria-label={tc('actions.edit')}
        />
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('methods.title')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('methods.new')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={methods.data}
        rowKey={(m) => m.id}
        loading={methods.isFetching}
      />
      <MethodModal
        method={editing && editing !== 'new' ? editing : undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

const schema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(50),
  provider: z.enum(PROVIDERS),
  is_cash: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0).max(1000),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function MethodModal({
  method,
  open,
  onClose,
}: {
  method?: PaymentMethod
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('payments')
  const { t: tc } = useTranslation()
  const save = useSavePaymentMethod()
  const { register, handleSubmit, control, setError, formState } = useForm<
    FormInput,
    unknown,
    FormValues
  >({
    resolver: zodResolver(schema),
    values: open
      ? {
          code: method?.code ?? '',
          name: method?.name ?? '',
          provider: method?.provider ?? 'manual',
          is_cash: method?.is_cash ?? false,
          is_active: method?.is_active ?? true,
          sort_order: method?.sort_order ?? 0,
        }
      : undefined,
  })

  const onSubmit = (values: FormValues) =>
    save.mutate(
      { id: method?.id, body: values },
      {
        onSuccess: () => {
          toast.success(t('methods.saved'))
          onClose()
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(schema.shape)),
      },
    )

  const toggle = (name: 'is_cash' | 'is_active', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center gap-3">
          <Switch checked={!!field.value} onChange={field.onChange} label={label} />
          <span className="text-sm">{label}</span>
        </div>
      )}
    />
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={method ? t('methods.edit') : t('methods.new')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="payment-method-form" loading={save.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form
        id="payment-method-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('methods.code')} required error={formState.errors.code?.message}>
            <Input {...register('code')} />
          </FormField>
          <FormField label={t('methods.name')} required error={formState.errors.name?.message}>
            <Input {...register('name')} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('methods.provider')} error={formState.errors.provider?.message}>
            <Select {...register('provider')}>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {t(`methods.providers.${p}`)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('methods.order')} error={formState.errors.sort_order?.message}>
            <Input type="number" min={0} {...register('sort_order')} />
          </FormField>
        </div>
        {toggle('is_cash', t('methods.isCash'))}
        {toggle('is_active', tc('fields.isActive'))}
      </form>
    </Modal>
  )
}
