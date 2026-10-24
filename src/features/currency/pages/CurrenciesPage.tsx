import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { Currency } from '@/shared/api/types'
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
  Switch,
  toast,
  type Column,
} from '@/shared/ui'

import { useCurrencies, useSaveCurrency } from '../api/currency.api'

export function CurrenciesPage() {
  const { t } = useTranslation('currency')
  const { t: tc } = useTranslation()
  const currencies = useCurrencies()
  const [editing, setEditing] = useState<Currency | 'new' | null>(null)

  const columns: Column<Currency>[] = [
    {
      key: 'code',
      header: t('currencies.code'),
      render: (c) => <code className="font-semibold">{c.code}</code>,
    },
    { key: 'name', header: t('currencies.name') },
    { key: 'symbol', header: t('currencies.symbol'), render: (c) => c.symbol || '—' },
    { key: 'decimal_places', header: t('currencies.decimalPlaces') },
    {
      key: 'is_active',
      header: tc('fields.isActive'),
      render: (c) => <ActiveBadge active={c.is_active ?? true} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (c) => (
        <Button
          size="sm"
          variant="ghost"
          icon={<Pencil className="size-4" />}
          onClick={() => setEditing(c)}
          aria-label={tc('actions.edit')}
        />
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('currencies.title')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('currencies.new')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={currencies.data}
        rowKey={(c) => c.id}
        loading={currencies.isFetching}
      />
      <CurrencyModal
        currency={editing && editing !== 'new' ? editing : undefined}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

const schema = z.object({
  code: z
    .string()
    .trim()
    .length(3)
    .regex(/^[a-z]{3}$/i, { message: 'code' }),
  name: z.string().trim().min(1).max(50),
  symbol: z.string().trim().max(10),
  decimal_places: z.coerce.number<string>().int().min(0).max(4),
  sort_order: z.coerce.number<string>().int().min(0),
  is_active: z.boolean(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function CurrencyModal({
  currency,
  open,
  onClose,
}: {
  currency?: Currency
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('currency')
  const { t: tc } = useTranslation()
  const save = useSaveCurrency()
  const { register, handleSubmit, control, setError, formState } = useForm<
    FormInput,
    unknown,
    FormValues
  >({
    resolver: zodResolver(schema),
    values: open
      ? {
          code: currency?.code ?? '',
          name: currency?.name ?? '',
          symbol: currency?.symbol ?? '',
          decimal_places: String(currency?.decimal_places ?? 2),
          sort_order: String(currency?.sort_order ?? 0),
          is_active: currency?.is_active ?? true,
        }
      : undefined,
  })

  const onSubmit = (values: FormValues) =>
    save.mutate(
      { id: currency?.id, body: { ...values, code: values.code.toUpperCase() } },
      {
        onSuccess: () => {
          toast.success(currency ? t('currencies.updated') : t('currencies.created'))
          onClose()
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(schema.shape)),
      },
    )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currency ? t('currencies.edit') : t('currencies.new')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="currency-form" loading={save.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id="currency-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label={t('currencies.code')}
            required
            hint={t('currencies.codeHint')}
            error={formState.errors.code ? tc('validation:invalid') : undefined}
          >
            <Input
              {...register('code')}
              className="uppercase"
              disabled={!!currency}
              maxLength={3}
            />
          </FormField>
          <FormField label={t('currencies.symbol')} error={formState.errors.symbol?.message}>
            <Input {...register('symbol')} />
          </FormField>
        </div>
        <FormField label={t('currencies.name')} required error={formState.errors.name?.message}>
          <Input {...register('name')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label={t('currencies.decimalPlaces')}
            error={formState.errors.decimal_places?.message}
          >
            <Input type="number" min={0} max={4} {...register('decimal_places')} />
          </FormField>
          <FormField label={t('currencies.sortOrder')} error={formState.errors.sort_order?.message}>
            <Input type="number" min={0} {...register('sort_order')} />
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
