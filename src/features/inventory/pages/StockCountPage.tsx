import { ArrowLeft, Ban, CheckCheck, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import { useCapability } from '@/features/auth'
import { ProductPicker, type PickedProduct } from '@/features/catalog'
import { useActiveCurrencies } from '@/features/currency'
import type { StockCountItem } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { cn } from '@/shared/lib/cn'
import { fromScaled, toScaled } from '@/shared/lib/decimal'
import { fitsPrecision, formatMoney, parseDecimalInput } from '@/shared/lib/money'
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Input,
  PageHeader,
  PageSpinner,
  Pagination,
  SearchInput,
  toast,
  type Column,
} from '@/shared/ui'

import {
  useCancelCount,
  useCompleteCount,
  useCount,
  useCountItems,
  useSetCounted,
} from '../api/documents.api'
import { CountStatusBadge } from '../components/DocStatusBadge'
import { formatQty } from '../lib/lines'

const STATES = ['', 'counted', 'uncounted', 'diff'] as const
const SCALE = 3

/** Sanalgan − hozirgi qoldiq (qoralamada taxminiy farq); kiritilmagan bo'lsa null. */
function previewDiff(counted: string | null | undefined, current: string | null | undefined) {
  const c = toScaled(counted ?? null, SCALE)
  if (c === null) return null
  return c - (toScaled(current ?? '0', SCALE) ?? 0n)
}

export function StockCountPage() {
  const { id } = useParams()
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const canManage = useCapability('inventory.counts.manage')
  const { base, decimals } = useActiveCurrencies()
  const count = useCount(id)
  const { params, page, set, setPage } = useListParams()
  const items = useCountItems(id!, { page, search: params.search, state: params.state })
  const setCounted = useSetCounted(id!)
  const complete = useCompleteCount()
  const cancel = useCancelCount()
  // saqlanmagan kiritishlar: tovar id → matn (sahifalar orasida saqlanadi)
  const [edits, setEdits] = useState<Record<number, { value: string; places: number }>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [extra, setExtra] = useState<PickedProduct | null>(null)
  const [extraQty, setExtraQty] = useState('')
  const [confirm, setConfirm] = useState<'complete' | 'cancel' | null>(null)

  if (count.isPending) return <PageSpinner />
  if (!count.data) return null
  const c = count.data
  const draft = c.status === 'draft'
  const editable = draft && canManage
  const baseDp = decimals[base] ?? 2
  const pending = Object.keys(edits).length

  const save = async (rows: Record<number, { value: string; places: number }>) => {
    const problems: Record<number, string> = {}
    const payload = Object.entries(rows).map(([productId, { value, places }]) => {
      const text = value.trim()
      if (text) {
        const n = toScaled(text, SCALE)
        if (n === null || n < 0n) problems[Number(productId)] = t('validation:positive')
        else if (!fitsPrecision(text, places))
          problems[Number(productId)] = t('doc.unitPrecision', { places })
      }
      return { product: Number(productId), counted_quantity: text ? parseDecimalInput(text) : null }
    })
    setErrors(problems)
    if (Object.keys(problems).length) return false
    try {
      await setCounted.mutateAsync({ items: payload })
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
      return false
    }
  }

  const onSave = async () => {
    if (await save(edits)) {
      setEdits({})
      toast.success(t('counts.savedCounts'))
    }
  }

  const onAddExtra = async () => {
    if (!extra) return
    const ok = await save({ [extra.id]: { value: extraQty, places: extra.unit_decimal_places } })
    if (ok) {
      setExtra(null)
      setExtraQty('')
    }
  }

  const onComplete = async () => {
    if (pending && !(await save(edits))) {
      setConfirm(null)
      return
    }
    setEdits({})
    complete.mutate(c.id, {
      onSuccess: () => toast.success(t('counts.completed')),
      onError: (error) => toast.error(error.message),
      onSettled: () => setConfirm(null),
    })
  }

  const valueFor = (row: StockCountItem) =>
    edits[row.product]?.value ?? formatQty(row.counted_quantity, row.unit_decimal_places)

  const columns: Column<StockCountItem>[] = [
    {
      key: 'product',
      header: t('doc.product'),
      render: (r) => (
        <div>
          <p className="font-medium">{r.product_name}</p>
          <p className="text-xs text-slate-500">
            {r.product_sku}
            {r.product_barcode && ` · ${r.product_barcode}`}
          </p>
        </div>
      ),
    },
    {
      key: 'expected',
      header: draft ? t('counts.current') : t('counts.expected'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) =>
        `${formatQty(draft ? r.current_quantity : r.expected_quantity, r.unit_decimal_places)} ${r.unit_code}`,
    },
    {
      key: 'counted',
      header: t('counts.counted'),
      className: 'w-40',
      render: (r) =>
        editable ? (
          <div>
            <Input
              inputMode="decimal"
              value={valueFor(r) === '—' ? '' : valueFor(r)}
              placeholder={t('counts.notCounted')}
              onChange={(e) =>
                setEdits({
                  ...edits,
                  [r.product]: { value: e.target.value, places: r.unit_decimal_places },
                })
              }
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                // skaner/klaviatura bilan tez sanash: keyingi qatorga o'tish
                const inputs = Array.from(
                  document.querySelectorAll<HTMLInputElement>('[data-count-input]'),
                )
                inputs[inputs.indexOf(e.currentTarget) + 1]?.focus()
              }}
              invalid={!!errors[r.product]}
              aria-label={`${t('counts.counted')}: ${r.product_name}`}
              data-count-input
              data-testid="count-input"
            />
            {errors[r.product] && <p className="mt-1 text-xs text-red-600">{errors[r.product]}</p>}
          </div>
        ) : (
          <span className="tabular-nums">
            {r.counted_quantity === null ? (
              <span className="text-slate-400">{t('counts.notCounted')}</span>
            ) : (
              formatQty(r.counted_quantity, r.unit_decimal_places)
            )}
          </span>
        ),
    },
    {
      key: 'difference',
      header: t('counts.difference'),
      className: 'text-right tabular-nums whitespace-nowrap',
      render: (r) => {
        const diff = draft
          ? previewDiff(edits[r.product]?.value ?? r.counted_quantity, r.current_quantity)
          : r.counted_quantity === null
            ? null
            : (toScaled(r.difference, SCALE) ?? 0n)
        if (diff === null) return <span className="text-slate-300">—</span>
        return (
          <span
            className={cn(
              diff > 0n && 'font-semibold text-emerald-700',
              diff < 0n && 'font-semibold text-red-700',
              diff === 0n && 'text-slate-400',
            )}
            data-testid="count-diff"
          >
            {diff > 0n ? '+' : ''}
            {formatQty(fromScaled(diff, SCALE), r.unit_decimal_places)}
          </span>
        )
      },
    },
    ...(!draft
      ? [
          {
            key: 'cost',
            header: t('counts.costDiff', { base }),
            className: 'text-right tabular-nums whitespace-nowrap',
            render: (r: StockCountItem) =>
              r.cost_difference_base === undefined || Number(r.cost_difference_base) === 0
                ? '—'
                : formatMoney(r.cost_difference_base, base, baseDp),
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title={c.number}
        subtitle={[
          c.branch_name,
          c.category_name,
          t('counts.progress', { counted: c.counted_count, total: c.items_count }),
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <CountStatusBadge status={c.status} />
            {editable && (
              <>
                <Button
                  variant="secondary"
                  icon={<Save className="size-4" />}
                  disabled={!pending}
                  loading={setCounted.isPending}
                  onClick={onSave}
                  data-testid="count-save"
                >
                  {t('counts.saveCounts')}
                  {pending > 0 && ` (${pending})`}
                </Button>
                <Button
                  icon={<CheckCheck className="size-4" />}
                  onClick={() => setConfirm('complete')}
                  data-testid="count-complete"
                >
                  {t('counts.complete')}
                </Button>
                <Button
                  variant="ghost"
                  icon={<Ban className="size-4" />}
                  onClick={() => setConfirm('cancel')}
                >
                  {t('doc.cancel')}
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/inventory/counts')}
            >
              {t('doc.back')}
            </Button>
          </>
        }
      />

      {draft && <p className="text-sm text-slate-500">{t('counts.draftNote')}</p>}
      {!draft && c.surplus_cost_base !== undefined && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs text-slate-500 uppercase">{t('counts.surplus')}</p>
            <p className="text-lg font-semibold text-emerald-700 tabular-nums">
              +{formatMoney(c.surplus_cost_base, base, baseDp)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 uppercase">{t('counts.shortage')}</p>
            <p className="text-lg font-semibold text-red-700 tabular-nums">
              −{formatMoney(c.shortage_cost_base ?? '0', base, baseDp)}
            </p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {STATES.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => set({ state: s })}
              className={cn(
                'px-3 py-1.5',
                (params.state ?? '') === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {t(
                s === ''
                  ? 'counts.filterAll'
                  : s === 'counted'
                    ? 'counts.filterCounted'
                    : s === 'uncounted'
                      ? 'counts.filterUncounted'
                      : 'counts.filterDiff',
              )}
            </button>
          ))}
        </div>
        <SearchInput
          value={params.search ?? ''}
          onChange={(v) => set({ search: v })}
          placeholder={t('counts.searchPlaceholder')}
          className="w-full sm:w-72"
        />
        {pending > 0 && (
          <span className="text-sm text-amber-700">{t('counts.unsaved', { count: pending })}</span>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={items.data?.results}
        rowKey={(r) => r.id}
        loading={items.isFetching}
      />
      <Pagination
        page={page}
        totalPages={items.data?.total_pages ?? 1}
        count={items.data?.count ?? 0}
        onChange={setPage}
      />

      {editable && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('counts.addProduct')}</h2>
          <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <ProductPicker value={extra} onChange={setExtra} />
            <Input
              inputMode="decimal"
              value={extraQty}
              onChange={(e) => setExtraQty(e.target.value)}
              placeholder={t('counts.counted')}
              aria-label={t('counts.counted')}
            />
            <Button
              variant="secondary"
              icon={<Plus className="size-4" />}
              disabled={!extra || !extraQty.trim()}
              loading={setCounted.isPending}
              onClick={onAddExtra}
            >
              {t('counts.add')}
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirm === 'complete'}
        title={t('counts.complete')}
        text={t('counts.completeConfirm')}
        confirmLabel={t('counts.complete')}
        danger={false}
        loading={complete.isPending || setCounted.isPending}
        onConfirm={() => void onComplete()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        title={t('doc.cancel')}
        text={t('counts.cancelConfirm')}
        confirmLabel={t('doc.cancel')}
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(c.id, {
            onSuccess: () => toast.success(t('counts.cancelled')),
            onError: (error) => toast.error(error.message),
            onSettled: () => setConfirm(null),
          })
        }
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}
