import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Ban, PackageCheck, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { ProductPicker, type PickedProduct } from '@/features/catalog'
import { useActiveCurrencies } from '@/features/currency'
import type { PurchaseDetail, PurchaseWriteRequest } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { formatDateTime } from '@/shared/lib/date'
import { formatMoney, formatNumber, parseDecimalInput, toDecimalInput } from '@/shared/lib/money'
import {
  Button,
  Card,
  ConfirmDialog,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageSpinner,
  Select,
  Textarea,
  toast,
} from '@/shared/ui'

import {
  useCancelPurchase,
  usePurchase,
  useReceivePurchase,
  useSavePurchase,
  useSuppliers,
  useExpenseTypes,
} from '../api/purchasing.api'
import { CostSummary } from '../components/CostSummary'
import { PurchaseStatusBadge } from '../components/PurchaseStatusBadge'
import { fitsPrecision, lineTotal, sumTotals } from '../lib/lines'

const decimalString = (min: number, strict = false) =>
  z
    .string()
    .trim()
    .min(1)
    .refine(
      (v) => {
        const n = Number(parseDecimalInput(v))
        return Number.isFinite(n) && (strict ? n > min : n >= min)
      },
      { message: 'positive' },
    )

const schema = z.object({
  branch: z.string().min(1),
  supplier: z.string().min(1),
  currency: z.string().min(1),
  invoice_number: z.string().trim().max(50),
  invoice_date: z.string(),
  note: z.string(),
  items: z
    .array(
      z.object({
        product: z
          .custom<PickedProduct | null>()
          .refine((v) => v !== null, { message: 'required' }),
        quantity: decimalString(0, true),
        unit_price: decimalString(0),
      }),
    )
    .min(1, { message: 'noLines' }),
  expenses: z.array(
    z.object({
      expense_type: z.string().min(1),
      currency: z.string().min(1),
      amount: decimalString(0, true),
      allocation_method: z.enum(['by_value', 'by_quantity']),
      note: z.string(),
    }),
  ),
})
/** Forma qiymatlari (tovar hali tanlanmagan bo'lishi mumkin) va tekshiruvdan keyingi qiymatlar. */
type FormValues = z.input<typeof schema>
type ValidValues = z.output<typeof schema>

function toFormValues(
  p: PurchaseDetail | undefined,
  defaults: { branch: string; currency: string },
): FormValues {
  if (!p) {
    return {
      branch: defaults.branch,
      supplier: '',
      currency: defaults.currency,
      invoice_number: '',
      invoice_date: '',
      note: '',
      items: [{ product: null, quantity: '', unit_price: '' }],
      expenses: [],
    }
  }
  return {
    branch: String(p.branch),
    supplier: String(p.supplier),
    currency: String(p.currency),
    invoice_number: p.invoice_number,
    invoice_date: p.invoice_date ?? '',
    note: p.note,
    items: p.items.map((i) => ({
      product: {
        id: i.product,
        name: i.product_name,
        sku: i.product_sku,
        unit_code: i.unit_code,
        unit_decimal_places: i.unit_decimal_places,
      },
      quantity: toDecimalInput(i.quantity),
      unit_price: toDecimalInput(i.unit_price),
    })),
    expenses: p.expenses.map((e) => ({
      expense_type: String(e.expense_type),
      currency: String(e.currency),
      amount: toDecimalInput(e.amount),
      allocation_method: e.allocation_method ?? 'by_value',
      note: e.note,
    })),
  }
}

function toRequest(values: ValidValues): PurchaseWriteRequest {
  return {
    branch: Number(values.branch),
    supplier: Number(values.supplier),
    currency: Number(values.currency),
    invoice_number: values.invoice_number,
    invoice_date: values.invoice_date || null,
    note: values.note,
    items: values.items.map((i) => ({
      product: i.product.id,
      quantity: parseDecimalInput(i.quantity),
      unit_price: parseDecimalInput(i.unit_price),
    })),
    expenses: values.expenses.map((e) => ({
      expense_type: Number(e.expense_type),
      currency: Number(e.currency),
      amount: parseDecimalInput(e.amount),
      allocation_method: e.allocation_method,
      note: e.note,
    })),
  }
}

/** /new → /:id ga o'tganda forma qayta yaratiladi. */
export function PurchaseFormPage() {
  const { id } = useParams()
  return <PurchaseForm key={id ?? 'new'} id={id} />
}

function PurchaseForm({ id }: { id?: string }) {
  const isNew = id === undefined
  const { t } = useTranslation('purchasing')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const canManage = useCapability('purchasing.manage')
  const user = useAuthStore((s) => s.user)
  const currentBranchId = useAuthStore((s) => s.currentBranchId)
  const { currencies, decimals, base } = useActiveCurrencies()

  const purchase = usePurchase(isNew ? undefined : id)
  const suppliers = useSuppliers({ is_active: 'true', page_size: 100 })
  const expenseTypes = useExpenseTypes()
  const save = useSavePurchase()
  const receive = useReceivePurchase()
  const cancel = useCancelPurchase()
  const [confirmReceive, setConfirmReceive] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const status = purchase.data?.status ?? 'draft'
  const editable = canManage && status === 'draft'
  const defaults = {
    branch: String(currentBranchId ?? user?.branches[0]?.id ?? ''),
    currency: String(currencies.find((c) => c.is_base)?.id ?? currencies[0]?.id ?? ''),
  }

  const { register, handleSubmit, control, setError, formState, setValue, getValues } = useForm<
    FormValues,
    unknown,
    ValidValues
  >({
    resolver: zodResolver(schema),
    values: isNew
      ? toFormValues(undefined, defaults)
      : purchase.data
        ? toFormValues(purchase.data, defaults)
        : undefined,
    resetOptions: { keepDirtyValues: true },
  })
  const items = useFieldArray({ control, name: 'items' })
  const expenses = useFieldArray({ control, name: 'expenses' })
  const watchedItems = useWatch({ control, name: 'items' })
  const currencyId = useWatch({ control, name: 'currency' })
  const currencyCode = currencies.find((c) => String(c.id) === currencyId)?.code ?? ''
  const places = decimals[currencyCode] ?? 2

  const onServerError = (error: unknown) =>
    applyServerErrors(
      error,
      setError,
      (field) =>
        ['branch', 'supplier', 'currency', 'invoice_number', 'invoice_date', 'note'].includes(
          field,
        ) ||
        field.startsWith('items.') ||
        field.startsWith('expenses.'),
    )

  const validatePrecision = (values: ValidValues): boolean => {
    let ok = true
    values.items.forEach((item, index) => {
      if (!fitsPrecision(item.quantity, item.product.unit_decimal_places)) {
        setError(`items.${index}.quantity`, {
          message: t('form.unitPrecision', { places: item.product.unit_decimal_places }),
        })
        ok = false
      }
    })
    return ok
  }

  const persist = async (values: ValidValues): Promise<PurchaseDetail | null> => {
    if (!validatePrecision(values)) return null
    try {
      const saved = await save.mutateAsync({ id, body: toRequest(values) })
      return saved
    } catch (error) {
      onServerError(error)
      return null
    }
  }

  const onSave = handleSubmit(async (values) => {
    const saved = await persist(values)
    if (!saved) return
    toast.success(isNew ? t('purchases.created') : t('purchases.saved'))
    if (isNew) navigate(`/purchasing/purchases/${saved.id}`, { replace: true })
  })

  const onReceive = handleSubmit(async (values) => {
    const saved = formState.isDirty || isNew ? await persist(values) : purchase.data
    if (!saved) return
    try {
      await receive.mutateAsync(saved.id)
      toast.success(t('purchases.received'))
      setConfirmReceive(false)
      if (isNew) navigate(`/purchasing/purchases/${saved.id}`, { replace: true })
    } catch (error) {
      setConfirmReceive(false)
      onServerError(error)
    }
  })

  if (!isNew && purchase.isPending) return <PageSpinner />
  const p = purchase.data
  const subtotal = sumTotals(watchedItems ?? [])
  const quantityError = (msg?: string) =>
    msg === 'positive'
      ? tc('validation:positive')
      : msg === 'required'
        ? tc('validation:required')
        : msg

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isNew ? t('purchases.new') : (p?.number ?? '')}
        subtitle={p ? `${p.supplier_name} · ${p.branch_name}` : undefined}
        actions={
          <>
            {p && <PurchaseStatusBadge status={p.status} />}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/purchasing/purchases')}
            >
              {tc('actions.back')}
            </Button>
          </>
        }
      />

      {!editable && p && (
        <p className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {t('form.readOnly')}
          {p.status === 'cancelled' && p.cancel_reason && ` — ${p.cancel_reason}`}
        </p>
      )}

      <form onSubmit={onSave} noValidate className="space-y-4">
        <fieldset disabled={!editable} className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t('form.header')}</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label={t('purchases.branch')}
                required
                error={formState.errors.branch?.message}
              >
                <Select {...register('branch')} disabled={!isNew || !editable}>
                  {user?.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label={t('purchases.supplier')}
                required
                error={formState.errors.supplier ? tc('validation:required') : undefined}
              >
                <Select {...register('supplier')} invalid={!!formState.errors.supplier}>
                  <option value="">—</option>
                  {suppliers.data?.results.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label={t('purchases.currency')}
                required
                error={formState.errors.currency?.message}
              >
                <Select {...register('currency')}>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label={t('purchases.invoiceNumber')}
                error={formState.errors.invoice_number?.message}
              >
                <Input {...register('invoice_number')} />
              </FormField>
              <FormField
                label={t('purchases.invoiceDate')}
                error={formState.errors.invoice_date?.message}
              >
                <Input type="date" {...register('invoice_date')} />
              </FormField>
              <FormField label={t('purchases.note')}>
                <Textarea rows={1} {...register('note')} />
              </FormField>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{t('form.lines')}</h2>
              {editable && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  onClick={() => items.append({ product: null, quantity: '', unit_price: '' })}
                >
                  {t('form.addLine')}
                </Button>
              )}
            </div>
            {formState.errors.items?.root?.message === 'noLines' ||
            formState.errors.items?.message === 'noLines' ? (
              <p className="mb-2 text-sm text-red-600">{t('form.noLines')}</p>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <tr>
                    <th className="w-8 pb-2">#</th>
                    <th className="pb-2">{t('form.product')}</th>
                    <th className="w-32 pb-2">{t('form.quantity')}</th>
                    <th className="w-36 pb-2">
                      {t('form.unitPrice')} ({currencyCode})
                    </th>
                    <th className="w-36 pb-2 text-right">{t('form.lineTotal')}</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.fields.map((field, index) => {
                    const row = watchedItems?.[index]
                    const err = formState.errors.items?.[index]
                    const total = row ? lineTotal(row.quantity, row.unit_price) : null
                    return (
                      <tr key={field.id} className="align-top">
                        <td className="py-1.5 pr-2 text-slate-400">{index + 1}</td>
                        <td className="py-1.5 pr-2">
                          <Controller
                            control={control}
                            name={`items.${index}.product`}
                            render={({ field: f }) => (
                              <ProductPicker
                                value={f.value}
                                onChange={f.onChange}
                                invalid={!!err?.product}
                                disabled={!editable}
                              />
                            )}
                          />
                          {err?.product && (
                            <p className="mt-1 text-xs text-red-600">
                              {quantityError(err.product.message)}
                            </p>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <div className="flex items-center gap-1">
                            <Input
                              inputMode="decimal"
                              {...register(`items.${index}.quantity`)}
                              invalid={!!err?.quantity}
                              aria-label={t('form.quantity')}
                            />
                            <span className="w-8 text-xs text-slate-500">
                              {row?.product?.unit_code}
                            </span>
                          </div>
                          {err?.quantity && (
                            <p className="mt-1 text-xs text-red-600">
                              {quantityError(err.quantity.message)}
                            </p>
                          )}
                        </td>
                        <td className="py-1.5 pr-2">
                          <Input
                            inputMode="decimal"
                            {...register(`items.${index}.unit_price`)}
                            invalid={!!err?.unit_price}
                            aria-label={t('form.unitPrice')}
                          />
                          {err?.unit_price && (
                            <p className="mt-1 text-xs text-red-600">
                              {quantityError(err.unit_price.message)}
                            </p>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 pt-3.5 text-right tabular-nums">
                          {total === null ? '—' : formatNumber(total, places)}
                        </td>
                        <td className="py-1.5">
                          {editable && items.fields.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Trash2 className="size-4" />}
                              onClick={() => items.remove(index)}
                              aria-label={tc('actions.delete')}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold">
                    <td colSpan={4} className="pt-2 text-right">
                      {t('purchases.subtotal')}
                    </td>
                    <td
                      className="pt-2 pr-2 text-right tabular-nums"
                      data-testid="purchase-subtotal"
                    >
                      {formatMoney(subtotal, currencyCode, places)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-700">{t('form.expenses')}</h2>
                <p className="text-xs text-slate-500">{t('form.expensesHint')}</p>
              </div>
              {editable && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  onClick={() => {
                    const first = expenseTypes.data?.find((e) => e.is_active !== false)
                    expenses.append({
                      expense_type: first ? String(first.id) : '',
                      currency: getValues('currency'),
                      amount: '',
                      allocation_method: first?.default_allocation ?? 'by_value',
                      note: '',
                    })
                  }}
                >
                  {t('form.addExpense')}
                </Button>
              )}
            </div>
            {expenses.fields.length === 0 && <p className="text-sm text-slate-400">—</p>}
            <div className="space-y-2">
              {expenses.fields.map((field, index) => {
                const err = formState.errors.expenses?.[index]
                return (
                  <div
                    key={field.id}
                    className="grid items-start gap-2 sm:grid-cols-[1fr_7rem_10rem_11rem_2.5rem]"
                  >
                    <Select
                      {...register(`expenses.${index}.expense_type`, {
                        onChange: (e) => {
                          const type = expenseTypes.data?.find(
                            (x) => String(x.id) === e.target.value,
                          )
                          if (type?.default_allocation)
                            setValue(`expenses.${index}.allocation_method`, type.default_allocation)
                        },
                      })}
                      aria-label={t('form.expenseType')}
                    >
                      {expenseTypes.data?.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      {...register(`expenses.${index}.currency`)}
                      aria-label={t('purchases.currency')}
                    >
                      {currencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code}
                        </option>
                      ))}
                    </Select>
                    <div>
                      <Input
                        inputMode="decimal"
                        placeholder={t('form.amount')}
                        {...register(`expenses.${index}.amount`)}
                        invalid={!!err?.amount}
                        aria-label={t('form.amount')}
                      />
                      {err?.amount && (
                        <p className="mt-1 text-xs text-red-600">
                          {quantityError(err.amount.message)}
                        </p>
                      )}
                    </div>
                    <Select
                      {...register(`expenses.${index}.allocation_method`)}
                      aria-label={t('form.allocation')}
                    >
                      <option value="by_value">{t('allocation.by_value')}</option>
                      <option value="by_quantity">{t('allocation.by_quantity')}</option>
                    </Select>
                    {editable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 className="size-4" />}
                        onClick={() => expenses.remove(index)}
                        aria-label={tc('actions.delete')}
                        className="h-10"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </fieldset>

        {editable && (
          <div className="flex flex-wrap justify-end gap-2">
            {!isNew && (
              <Button
                variant="secondary"
                icon={<Ban className="size-4" />}
                onClick={() => setCancelOpen(true)}
              >
                {t('form.cancel')}
              </Button>
            )}
            <Button type="submit" variant="secondary" loading={save.isPending && !confirmReceive}>
              {t('form.save')}
            </Button>
            <Button
              icon={<PackageCheck className="size-4" />}
              onClick={() => setConfirmReceive(true)}
            >
              {formState.isDirty || isNew ? t('form.saveAndReceive') : t('form.receive')}
            </Button>
          </div>
        )}
      </form>

      {p && (
        <div className="mt-6">
          <CostSummary purchase={p} base={base} decimals={decimals} dirty={formState.isDirty} />
        </div>
      )}

      {p && p.status !== 'draft' && (
        <Card className="mt-4 text-xs text-slate-500">
          <p>
            {t('purchases.createdBy')}: {p.created_by_name ?? '—'} · {formatDateTime(p.created_at)}
          </p>
          {p.received_at && (
            <p>
              {t('purchases.receivedBy')}: {p.received_by_name ?? '—'} ·{' '}
              {formatDateTime(p.received_at)}
            </p>
          )}
          {p.cancelled_at && (
            <p>
              {t('purchases.cancelledBy')}: {p.cancelled_by_name ?? '—'} ·{' '}
              {formatDateTime(p.cancelled_at)}
            </p>
          )}
          {canManage && p.status === 'received' && (
            <div className="mt-3">
              {p.can_cancel ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Ban className="size-4" />}
                  onClick={() => setCancelOpen(true)}
                >
                  {t('form.cancel')}
                </Button>
              ) : (
                <span>{t('form.cannotCancel')}</span>
              )}
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={confirmReceive}
        title={t('form.receive')}
        text={t('form.receiveConfirm')}
        confirmLabel={t('form.receive')}
        danger={false}
        loading={save.isPending || receive.isPending}
        onConfirm={() => void onReceive()}
        onClose={() => setConfirmReceive(false)}
      />
      {p && (
        <CancelModal
          open={cancelOpen}
          loading={cancel.isPending}
          onClose={() => setCancelOpen(false)}
          onConfirm={(reason) =>
            cancel.mutate(
              { id: p.id, reason },
              {
                onSuccess: () => {
                  toast.success(t('purchases.cancelled'))
                  setCancelOpen(false)
                },
                onError: (error) => {
                  setCancelOpen(false)
                  toast.error(error.message)
                },
              },
            )
          }
        />
      )}
    </div>
  )
}

function CancelModal({
  open,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean
  loading: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const { t } = useTranslation('purchasing')
  const { t: tc } = useTranslation()
  const [reason, setReason] = useState('')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('form.cancel')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tc('actions.close')}
          </Button>
          <Button
            variant="danger"
            loading={loading}
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {t('form.cancel')}
          </Button>
        </>
      }
    >
      <FormField label={t('form.cancelReason')} required hint={t('form.cancelHint')}>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </FormField>
    </Modal>
  )
}
