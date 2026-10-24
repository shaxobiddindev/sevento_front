import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useCapability } from '@/features/auth'
import type { PriceType, Unit } from '@/shared/api/types'
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

import { usePriceTypes, useSavePriceType, useSaveUnit, useUnits } from '../api/catalog.api'

/** O'lchov birliklari va narx turlari — MB dagi ma'lumotnomalar (kodda qattiq yozilmaydi). */
export function ReferencesPage() {
  const { t } = useTranslation('catalog')
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title={t('references.title')} />
      <UnitsSection />
      <PriceTypesSection />
    </div>
  )
}

function SectionHeader({
  title,
  onAdd,
  addLabel,
}: {
  title: string
  onAdd?: () => void
  addLabel: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      {onAdd && (
        <Button size="sm" icon={<Plus className="size-4" />} onClick={onAdd}>
          {addLabel}
        </Button>
      )}
    </div>
  )
}

function editColumn<T>(onEdit: (row: T) => void, label: string): Column<T> {
  return {
    key: 'actions',
    header: '',
    className: 'text-right',
    render: (row) => (
      <Button
        size="sm"
        variant="ghost"
        icon={<Pencil className="size-4" />}
        onClick={() => onEdit(row)}
        aria-label={label}
      />
    ),
  }
}

// --- o'lchov birliklari ---

const unitSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(50),
  decimal_places: z.coerce.number<string>().int().min(0).max(3),
  is_active: z.boolean(),
})
type UnitInput = z.input<typeof unitSchema>
type UnitValues = z.output<typeof unitSchema>

function UnitsSection() {
  const { t } = useTranslation('catalog')
  const { t: tc } = useTranslation()
  const canManage = useCapability('catalog.manage')
  const units = useUnits()
  const save = useSaveUnit()
  const [editing, setEditing] = useState<Unit | 'new' | null>(null)
  const unit = editing && editing !== 'new' ? editing : undefined

  const { register, handleSubmit, control, setError, formState } = useForm<
    UnitInput,
    unknown,
    UnitValues
  >({
    resolver: zodResolver(unitSchema),
    values: editing
      ? {
          code: unit?.code ?? '',
          name: unit?.name ?? '',
          decimal_places: String(unit?.decimal_places ?? 0),
          is_active: unit?.is_active ?? true,
        }
      : undefined,
  })

  const columns: Column<Unit>[] = [
    { key: 'code', header: t('references.code'), render: (u) => <code>{u.code}</code> },
    { key: 'name', header: t('references.name') },
    { key: 'decimal_places', header: t('references.decimalPlaces') },
    {
      key: 'is_active',
      header: tc('fields.isActive'),
      render: (u) => <ActiveBadge active={u.is_active ?? true} />,
    },
    ...(canManage ? [editColumn<Unit>(setEditing, tc('actions.edit'))] : []),
  ]

  const onSubmit = (values: UnitValues) =>
    save.mutate(
      { id: unit?.id, body: values },
      {
        onSuccess: () => {
          toast.success(t('references.saved'))
          setEditing(null)
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(unitSchema.shape)),
      },
    )

  return (
    <section>
      <SectionHeader
        title={t('references.units')}
        addLabel={t('references.newUnit')}
        onAdd={canManage ? () => setEditing('new') : undefined}
      />
      <DataTable
        columns={columns}
        rows={units.data}
        rowKey={(u) => u.id}
        loading={units.isFetching}
      />
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={unit ? t('references.editUnit') : t('references.newUnit')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form="unit-form" loading={save.isPending}>
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        <form id="unit-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('references.code')} required error={formState.errors.code?.message}>
              <Input {...register('code')} />
            </FormField>
            <FormField label={t('references.name')} required error={formState.errors.name?.message}>
              <Input {...register('name')} />
            </FormField>
          </div>
          <FormField
            label={t('references.decimalPlaces')}
            hint={t('references.decimalPlacesHint')}
            error={formState.errors.decimal_places?.message}
          >
            <Input type="number" min={0} max={3} {...register('decimal_places')} />
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
    </section>
  )
}

// --- narx turlari ---

const priceTypeSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(50),
  is_default: z.boolean(),
  sort_order: z.coerce.number<string>().int().min(0),
})
type PriceTypeInput = z.input<typeof priceTypeSchema>
type PriceTypeValues = z.output<typeof priceTypeSchema>

function PriceTypesSection() {
  const { t } = useTranslation('catalog')
  const { t: tc } = useTranslation()
  const canManage = useCapability('catalog.manage')
  const priceTypes = usePriceTypes()
  const save = useSavePriceType()
  const [editing, setEditing] = useState<PriceType | 'new' | null>(null)
  const priceType = editing && editing !== 'new' ? editing : undefined

  const { register, handleSubmit, control, setError, formState } = useForm<
    PriceTypeInput,
    unknown,
    PriceTypeValues
  >({
    resolver: zodResolver(priceTypeSchema),
    values: editing
      ? {
          code: priceType?.code ?? '',
          name: priceType?.name ?? '',
          is_default: priceType?.is_default ?? false,
          sort_order: String(priceType?.sort_order ?? 0),
        }
      : undefined,
  })

  const columns: Column<PriceType>[] = [
    { key: 'code', header: t('references.code'), render: (p) => <code>{p.code}</code> },
    { key: 'name', header: t('references.name') },
    {
      key: 'is_default',
      header: '',
      render: (p) =>
        p.is_default ? <Badge tone="brand">{t('references.isDefault')}</Badge> : null,
    },
    ...(canManage ? [editColumn<PriceType>(setEditing, tc('actions.edit'))] : []),
  ]

  const onSubmit = (values: PriceTypeValues) =>
    save.mutate(
      { id: priceType?.id, body: values },
      {
        onSuccess: () => {
          toast.success(t('references.saved'))
          setEditing(null)
        },
        onError: (error) => applyServerErrors(error, setError, Object.keys(priceTypeSchema.shape)),
      },
    )

  return (
    <section>
      <SectionHeader
        title={t('references.priceTypes')}
        addLabel={t('references.newPriceType')}
        onAdd={canManage ? () => setEditing('new') : undefined}
      />
      <DataTable
        columns={columns}
        rows={priceTypes.data}
        rowKey={(p) => p.id}
        loading={priceTypes.isFetching}
      />
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={priceType ? t('references.editPriceType') : t('references.newPriceType')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {tc('actions.cancel')}
            </Button>
            <Button type="submit" form="price-type-form" loading={save.isPending}>
              {tc('actions.save')}
            </Button>
          </>
        }
      >
        <form
          id="price-type-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('references.code')} required error={formState.errors.code?.message}>
              <Input {...register('code')} />
            </FormField>
            <FormField label={t('references.name')} required error={formState.errors.name?.message}>
              <Input {...register('name')} />
            </FormField>
          </div>
          <FormField label={t('references.sortOrder')} error={formState.errors.sort_order?.message}>
            <Input type="number" min={0} {...register('sort_order')} />
          </FormField>
          <Controller
            control={control}
            name="is_default"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch
                  checked={field.value}
                  onChange={field.onChange}
                  label={t('references.isDefault')}
                />
                <span className="text-sm">{t('references.isDefault')}</span>
              </div>
            )}
          />
        </form>
      </Modal>
    </section>
  )
}
