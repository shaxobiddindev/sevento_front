import { zodResolver } from '@hookform/resolvers/zod'
import { Tag } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useAuthStore, useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import type { Product, ProductPrice } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { formatDateTime } from '@/shared/lib/date'
import { formatMoney, parseDecimalInput } from '@/shared/lib/money'
import {
  Badge,
  Button,
  Card,
  DataTable,
  FormField,
  Input,
  Modal,
  Select,
  toast,
  type Column,
} from '@/shared/ui'

import { usePriceHistory, usePriceTypes, useSetPrice } from '../api/catalog.api'

/** Tovar sahifasidagi narxlar: joriy narxlar (joriy nuqta uchun), narx qo'yish, tarix. */
export function ProductPrices({ product }: { product: Product }) {
  const { t } = useTranslation('catalog')
  const canSetPrice = useCapability('catalog.prices.manage')
  const { decimals } = useActiveCurrencies()
  const history = usePriceHistory(product.id)
  const [open, setOpen] = useState(false)

  const historyColumns: Column<ProductPrice>[] = [
    {
      key: 'valid_from',
      header: t('prices.validFrom'),
      render: (p) => formatDateTime(p.valid_from),
    },
    { key: 'type', header: t('prices.type'), render: (p) => p.price_type_name },
    {
      key: 'amount',
      header: t('prices.amount'),
      className: 'tabular-nums',
      render: (p) => formatMoney(p.amount, p.currency_code, decimals[p.currency_code] ?? 2),
    },
    {
      key: 'branch',
      header: t('prices.branch'),
      render: (p) =>
        p.branch_name ?? <span className="text-slate-400">{t('prices.allBranches')}</span>,
    },
    { key: 'by', header: t('prices.by'), render: (p) => p.created_by_name ?? '—' },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{t('prices.title')}</h2>
            <p className="text-xs text-slate-500">{t('prices.subtitle')}</p>
          </div>
          {canSetPrice && (
            <Button size="sm" icon={<Tag className="size-4" />} onClick={() => setOpen(true)}>
              {t('prices.set')}
            </Button>
          )}
        </div>
        {product.prices.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {product.prices.map((p) => (
              <div
                key={`${p.price_type}-${p.currency}`}
                className="rounded-md border border-slate-200 p-3"
                data-testid={`price-${p.price_type}-${p.currency}`}
              >
                <p className="text-xs text-slate-500">{p.price_type_name}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                  {formatMoney(p.amount, p.currency, decimals[p.currency] ?? 2)}
                </p>
                {p.branch && <Badge tone="brand">{t('prices.branchSpecific')}</Badge>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('prices.empty')}</p>
        )}
      </Card>

      <div>
        <h2 className="mb-2 text-base font-semibold">{t('prices.history')}</h2>
        <DataTable
          columns={historyColumns}
          rows={history.data}
          rowKey={(p) => p.id}
          loading={history.isFetching}
          emptyText={t('prices.empty')}
        />
      </div>

      <SetPriceModal productId={product.id} open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

const schema = z.object({
  price_type: z.string().min(1),
  currency: z.string().min(1),
  branch: z.string(),
  amount: z
    .string()
    .trim()
    .min(1)
    .refine((v) => Number(parseDecimalInput(v)) >= 0, { message: 'positive' }),
})
type FormValues = z.infer<typeof schema>

function SetPriceModal({
  productId,
  open,
  onClose,
}: {
  productId: number
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('catalog')
  const { t: tc } = useTranslation()
  const priceTypes = usePriceTypes()
  const { currencies } = useActiveCurrencies()
  const user = useAuthStore((s) => s.user)
  const setPrice = useSetPrice(productId)

  const defaultType = priceTypes.data?.find((p) => p.is_default) ?? priceTypes.data?.[0]
  const { register, handleSubmit, reset, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: open
      ? {
          price_type: defaultType ? String(defaultType.id) : '',
          currency: currencies[0] ? String(currencies[0].id) : '',
          branch: '',
          amount: '',
        }
      : undefined,
    // narx turlari/valyutalar kech yuklansa — foydalanuvchi tanlagani (masalan UZS) saqlanib qoladi
    resetOptions: { keepDirtyValues: true },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = (values: FormValues) =>
    setPrice.mutate(
      {
        price_type: Number(values.price_type),
        currency: Number(values.currency),
        branch: values.branch ? Number(values.branch) : null,
        amount: parseDecimalInput(values.amount),
      },
      {
        onSuccess: () => {
          toast.success(t('prices.saved'))
          close()
        },
        onError: (error) =>
          applyServerErrors(error, setError, ['price_type', 'currency', 'branch', 'amount']),
      },
    )

  const amountError =
    formState.errors.amount?.message === 'positive'
      ? tc('validation:positive')
      : formState.errors.amount?.message

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('prices.set')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="price-form" loading={setPrice.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id="price-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('prices.type')} error={formState.errors.price_type?.message}>
            <Select {...register('price_type')}>
              {priceTypes.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('prices.currency')} error={formState.errors.currency?.message}>
            <Select {...register('currency')}>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField label={t('prices.amount')} required error={amountError}>
          <Input inputMode="decimal" autoFocus {...register('amount')} />
        </FormField>
        <FormField label={t('prices.branch')} error={formState.errors.branch?.message}>
          <Select {...register('branch')}>
            <option value="">{t('prices.allBranches')}</option>
            {user?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </FormField>
      </form>
    </Modal>
  )
}
