import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useCapability } from '@/features/auth'
import type { ExchangeRate, LatestRate } from '@/shared/api/types'
import { applyServerErrors } from '@/shared/forms/serverErrors'
import { z } from '@/shared/forms/zod'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDate } from '@/shared/lib/date'
import { formatNumber, parseDecimalInput } from '@/shared/lib/money'
import {
  Badge,
  Button,
  Card,
  DataTable,
  FormField,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  toast,
  type Column,
} from '@/shared/ui'

import { useFetchRates, useLatestRates, useRateHistory, useSetRate } from '../api/currency.api'

export function CurrencyRatesPage() {
  const { t } = useTranslation('currency')
  const canManage = useCapability('currency.rates.manage')
  const latest = useLatestRates()
  const fetchRates = useFetchRates()
  const [editing, setEditing] = useState<LatestRate | 'new' | null>(null)

  const onFetch = () =>
    fetchRates.mutate(undefined, {
      onSuccess: (result) =>
        result.updated.length
          ? toast.success(t('fetched', { count: result.updated.length }))
          : toast.info(t('fetchedNone')),
      onError: (error) => toast.error(error.message),
    })

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          canManage && (
            <>
              <Button
                variant="secondary"
                icon={<RefreshCw className="size-4" />}
                onClick={onFetch}
                loading={fetchRates.isPending}
              >
                {t('fetch')}
              </Button>
              <Button onClick={() => setEditing('new')}>{t('setRate')}</Button>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {latest.data?.map((rate) => (
          <Card key={rate.code} className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  {rate.code} · {rate.name}
                </p>
                {rate.rate ? (
                  <p
                    className="mt-1 text-2xl font-semibold tabular-nums"
                    data-testid={`rate-${rate.code}`}
                  >
                    {formatNumber(rate.rate, 2)}{' '}
                    <span className="text-base font-normal text-slate-500">{t('quoteSymbol')}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-lg text-slate-400">{t('noRate')}</p>
                )}
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Pencil className="size-4" />}
                  onClick={() => setEditing(rate)}
                  aria-label={t('setRate')}
                />
              )}
            </div>
            {rate.date && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                {t('asOf', { date: formatDate(rate.date) })}
                {rate.source && (
                  <Badge tone={rate.source === 'manual' ? 'warning' : 'info'}>
                    {t(`source.${rate.source}`, { defaultValue: rate.source })}
                  </Badge>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      <RateHistory />

      <SetRateModal
        open={editing !== null}
        initialCurrency={editing && editing !== 'new' ? editing.currency : undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}

function RateHistory() {
  const { t } = useTranslation('currency')
  const { params, page, set, setPage } = useListParams()
  const latest = useLatestRates()
  const history = useRateHistory({ page, currency: params.currency })

  const columns: Column<ExchangeRate>[] = [
    { key: 'date', header: t('history.date'), render: (r) => formatDate(r.date) },
    { key: 'currency', header: t('history.currency'), render: (r) => r.currency_code },
    {
      key: 'rate',
      header: t('history.rate'),
      className: 'tabular-nums',
      render: (r) => `${formatNumber(r.rate, 2)} ${t('quoteSymbol')}`,
    },
    {
      key: 'source',
      header: t('history.source'),
      render: (r) => (
        <Badge tone={r.source === 'manual' ? 'warning' : 'info'}>
          {t(`source.${r.source}`, { defaultValue: r.source })}
        </Badge>
      ),
    },
    { key: 'by', header: t('history.by'), render: (r) => r.created_by_name ?? '—' },
  ]

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{t('history.title')}</h2>
        <Select
          value={params.currency ?? ''}
          onChange={(e) => set({ currency: e.target.value })}
          className="w-full sm:w-48"
        >
          <option value="">{t('history.allCurrencies')}</option>
          {latest.data?.map((r) => (
            <option key={r.currency} value={r.currency}>
              {r.code}
            </option>
          ))}
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={history.data?.results}
        rowKey={(r) => r.id}
        loading={history.isFetching}
      />
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={history.data?.total_pages ?? 1}
          count={history.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}

const rateSchema = z.object({
  currency: z.string().min(1),
  rate: z
    .string()
    .trim()
    .min(1)
    .refine((v) => Number(parseDecimalInput(v)) > 0, { message: 'positive' }),
  date: z.string(),
})
type RateValues = z.infer<typeof rateSchema>

function SetRateModal({
  open,
  initialCurrency,
  onClose,
}: {
  open: boolean
  initialCurrency?: number
  onClose: () => void
}) {
  const { t } = useTranslation('currency')
  const { t: tc } = useTranslation()
  const latest = useLatestRates()
  const setRate = useSetRate()
  const { register, handleSubmit, reset, setError, formState } = useForm<RateValues>({
    resolver: zodResolver(rateSchema),
    values: open
      ? {
          currency: initialCurrency
            ? String(initialCurrency)
            : String(latest.data?.[0]?.currency ?? ''),
          rate: '',
          date: '',
        }
      : undefined,
    // kurslar ro'yxati kech kelsa tanlangan valyuta almashib ketmasin
    resetOptions: { keepDirtyValues: true },
  })

  const close = () => {
    reset()
    onClose()
  }

  const onSubmit = (values: RateValues) =>
    setRate.mutate(
      {
        currency: Number(values.currency),
        rate: parseDecimalInput(values.rate),
        ...(values.date ? { date: values.date } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t('rateSaved'))
          close()
        },
        onError: (error) => applyServerErrors(error, setError, ['currency', 'rate', 'date']),
      },
    )

  const rateError =
    formState.errors.rate?.message === 'positive'
      ? tc('validation:positive')
      : formState.errors.rate?.message

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('setRate')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form="rate-form" loading={setRate.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id="rate-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label={t('form.currency')} error={formState.errors.currency?.message}>
          <Select {...register('currency')}>
            {latest.data?.map((r) => (
              <option key={r.currency} value={r.currency}>
                {r.code} — {r.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('form.rate')} required error={rateError}>
          <Input inputMode="decimal" autoFocus placeholder="12650.45" {...register('rate')} />
        </FormField>
        <FormField
          label={t('form.date')}
          hint={t('form.dateHint')}
          error={formState.errors.date?.message}
        >
          <Input type="date" {...register('date')} />
        </FormField>
      </form>
    </Modal>
  )
}
