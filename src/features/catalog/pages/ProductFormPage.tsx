import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Warehouse } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import type { Product } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { parseDecimalInput } from '@/shared/lib/money'
import {
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  PageSpinner,
  Select,
  Switch,
  Textarea,
  toast,
} from '@/shared/ui'

import { useCategoryTree, useProduct, useSaveProduct, useUnits } from '../api/catalog.api'
import { ProductPrices } from '../components/ProductPrices'
import { flattenTree, indentLabel } from '../lib/tree'

const schema = z.object({
  sku: z.string().trim().min(1).max(50),
  barcode: z.string().trim().max(64),
  name: z.string().trim().min(1).max(200),
  category: z.string(),
  unit: z.string().min(1),
  min_quantity: z
    .string()
    .trim()
    .refine((v) => v === '' || Number(parseDecimalInput(v)) >= 0, { message: 'positive' }),
  description: z.string(),
  is_active: z.boolean(),
})
type FormValues = z.infer<typeof schema>
const FIELDS = Object.keys(schema.shape)

function toFormValues(product?: Product, defaultUnit?: number): FormValues {
  return {
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    name: product?.name ?? '',
    category: product?.category ? String(product.category) : '',
    unit: product ? String(product.unit) : defaultUnit ? String(defaultUnit) : '',
    min_quantity: product?.min_quantity ?? '',
    description: product?.description ?? '',
    is_active: product?.is_active ?? true,
  }
}

/** /new → /:id ga o'tganda forma yangidan yaratiladi (aks holda eski kiritilgan qiymatlar qoladi). */
export function ProductFormPage() {
  const { id } = useParams()
  return <ProductForm key={id ?? 'new'} id={id} />
}

function ProductForm({ id }: { id?: string }) {
  const isNew = id === undefined
  const { t } = useTranslation('catalog')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const canManage = useCapability('catalog.manage')
  const canViewStock = useCapability('inventory.view')
  const branchId = useAuthStore((s) => s.currentBranchId)

  const product = useProduct(isNew ? undefined : id, branchId)
  const units = useUnits()
  const tree = useCategoryTree()
  const save = useSaveProduct()
  const flat = useMemo(() => flattenTree(tree.data ?? []), [tree.data])
  const defaultUnit = units.data?.find((u) => u.is_active !== false)?.id

  const { register, handleSubmit, control, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: isNew
      ? toFormValues(undefined, defaultUnit)
      : product.data
        ? toFormValues(product.data)
        : undefined,
    resetOptions: { keepDirtyValues: true },
  })

  const onSubmit = (values: FormValues) => {
    const body = {
      sku: values.sku,
      barcode: values.barcode,
      name: values.name,
      category: values.category ? Number(values.category) : null,
      unit: Number(values.unit),
      min_quantity: values.min_quantity ? parseDecimalInput(values.min_quantity) : null,
      description: values.description,
      is_active: values.is_active,
    }
    save.mutate(
      { id, body },
      {
        onSuccess: (saved) => {
          toast.success(isNew ? t('products.created') : t('products.updated'))
          if (isNew) navigate(`/catalog/products/${saved.id}`, { replace: true })
        },
        onError: (error) => applyServerErrors(error, setError, FIELDS),
      },
    )
  }

  if (!isNew && product.isPending) return <PageSpinner />
  const readOnly = !canManage
  const minQtyError =
    formState.errors.min_quantity?.message === 'positive'
      ? tc('validation:positive')
      : formState.errors.min_quantity?.message

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={isNew ? t('products.new') : (product.data?.name ?? t('products.edit'))}
        subtitle={readOnly ? t('products.readOnly') : product.data?.sku}
        actions={
          <>
            {!isNew && canViewStock && (
              <Button
                variant="secondary"
                icon={<Warehouse className="size-4" />}
                onClick={() => navigate(`/inventory/products/${id}`)}
              >
                {t('products.stockLink')}
              </Button>
            )}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/catalog/products')}
            >
              {tc('actions.back')}
            </Button>
          </>
        }
      />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <fieldset disabled={readOnly}>
          <Card className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label={t('products.sku')} required error={formState.errors.sku?.message}>
                <Input
                  {...register('sku')}
                  className="uppercase"
                  invalid={!!formState.errors.sku}
                />
              </FormField>
              <FormField label={t('products.barcode')} error={formState.errors.barcode?.message}>
                <Input
                  {...register('barcode')}
                  inputMode="numeric"
                  invalid={!!formState.errors.barcode}
                />
              </FormField>
              <FormField label={t('products.unit')} required error={formState.errors.unit?.message}>
                <Select {...register('unit')}>
                  {units.data
                    ?.filter((u) => u.is_active !== false)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.code})
                      </option>
                    ))}
                </Select>
              </FormField>
            </div>
            <FormField label={t('products.name')} required error={formState.errors.name?.message}>
              <Input {...register('name')} invalid={!!formState.errors.name} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={t('products.category')} error={formState.errors.category?.message}>
                <Select {...register('category')}>
                  <option value="">{t('products.noCategory')}</option>
                  {flat.map((c) => (
                    <option key={c.id} value={c.id}>
                      {indentLabel(c)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label={t('products.minQuantity')}
                hint={t('products.minQuantityHint')}
                error={minQtyError}
              >
                <Input {...register('min_quantity')} inputMode="decimal" />
              </FormField>
            </div>
            <FormField
              label={t('products.description')}
              error={formState.errors.description?.message}
            >
              <Textarea rows={3} {...register('description')} />
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
                    disabled={readOnly}
                  />
                  <span className="text-sm">{tc('fields.isActive')}</span>
                </div>
              )}
            />
            {!readOnly && (
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button variant="secondary" onClick={() => navigate('/catalog/products')}>
                  {tc('actions.cancel')}
                </Button>
                <Button type="submit" loading={save.isPending}>
                  {isNew ? tc('actions.create') : tc('actions.save')}
                </Button>
              </div>
            )}
          </Card>
        </fieldset>
      </form>

      <div className="mt-6">
        {isNew || !product.data ? (
          <Card>
            <p className="text-sm text-slate-500">{t('prices.saveFirst')}</p>
          </Card>
        ) : (
          <ProductPrices product={product.data} />
        )}
      </div>
    </div>
  )
}
