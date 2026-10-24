import { CreditCard, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore, useCapability } from '@/features/auth'
import { usePriceTypes } from '@/features/catalog'
import { useActiveCurrencies, useLatestRates } from '@/features/currency'
import {
  CustomerFormModal,
  CustomerPicker,
  useCustomer,
  usePaymentMethods,
} from '@/features/payments'
import { newIdempotencyKey } from '@/shared/api/client'
import { isApiError, toApiError, type ApiError } from '@/shared/api/errors'
import type { SaleDetail } from '@/shared/api/types'
import { convertTo4 } from '@/shared/lib/decimal'
import { formatNumber, parseDecimalInput } from '@/shared/lib/money'
import {
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  FormField,
  PageHeader,
  PageSpinner,
  Select,
  toast,
} from '@/shared/ui'

import { salesApi, useCreateSale, usePosConfig } from '../api/sales.api'
import { CartTable } from '../components/CartTable'
import { PaymentModal, type CreditOptions, type PaymentInput } from '../components/PaymentModal'
import { ProductSearch } from '../components/ProductSearch'
import { SaleSuccessModal } from '../components/SaleSuccessModal'
import { cartIsValid } from '../lib/cart'
import { cartTotals, minorToString } from '../lib/money'
import { printReceipt } from '../lib/receipt'
import { useCartStore, type CartLine } from '../store/cart'

const AUTO_PRINT_KEY = 'sevento.pos.autoPrint'

function readAutoPrint(): boolean {
  try {
    return localStorage.getItem(AUTO_PRINT_KEY) === '1'
  } catch {
    return false
  }
}

/** Kassa (POS): skaner/qidiruv → savat → to'lov (aralash valyuta) → chek. */
export function PosPage() {
  const { t } = useTranslation('sales')
  const user = useAuthStore((s) => s.user)
  const branchId = useAuthStore((s) => s.currentBranchId)
  const setCurrentBranch = useAuthStore((s) => s.setCurrentBranch)

  if (!user) return null
  if (branchId === null) {
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title={t('pos.title')} />
        <Card>
          <FormField label={t('pos.chooseBranch')}>
            <Select
              value=""
              onChange={(e) => e.target.value && setCurrentBranch(Number(e.target.value))}
              data-testid="pos-branch"
            >
              <option value="">—</option>
              {user.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
        </Card>
      </div>
    )
  }
  return <PosLoader key={branchId} branchId={branchId} />
}

/**
 * Kassa sozlamalari (boshlang'ich valyuta, narx turi, valyutalar) yuklanmaguncha kassa ochilmaydi:
 * aks holda tovar bir valyutada olinib, keyin boshqa valyutada ko'rsatilishi mumkin edi.
 */
function PosLoader({ branchId }: { branchId: number }) {
  const { currencies } = useActiveCurrencies()
  const priceTypes = usePriceTypes()
  const config = usePosConfig()
  if (!config.data || !priceTypes.data || currencies.length === 0) return <PageSpinner />
  const defaultCurrency = currencies.some((c) => c.code === config.data.default_currency)
    ? config.data.default_currency
    : currencies[0].code
  const defaultPriceTypeId =
    priceTypes.data.find((p) => p.is_default)?.id ?? priceTypes.data[0]?.id ?? null
  return (
    <PosTerminal
      branchId={branchId}
      defaultCurrency={defaultCurrency}
      defaultPriceTypeId={defaultPriceTypeId}
    />
  )
}

function PosTerminal({
  branchId,
  defaultCurrency,
  defaultPriceTypeId,
}: {
  branchId: number
  defaultCurrency: string
  defaultPriceTypeId: number | null
}) {
  const { t } = useTranslation('sales')
  const canDiscount = useCapability('sales.discount')
  const canCredit = useCapability('sales.credit')
  const canCreateCustomer = useCapability('customers.manage')
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const { currencies, decimals } = useActiveCurrencies()
  const priceTypes = usePriceTypes()
  const methods = usePaymentMethods()
  const latest = useLatestRates()
  const config = usePosConfig()
  const createSale = useCreateSale()
  const searchRef = useRef<HTMLInputElement | null>(null)

  const cart = useCartStore()
  const currency = cart.currency || defaultCurrency
  const priceTypeId = cart.priceTypeId ?? defaultPriceTypeId
  const places = decimals[currency] ?? 2

  // kontekst savatga qotiriladi (nuqta boshqa bo'lsa savat tozalanadi)
  useEffect(() => {
    if (cart.branchId !== branchId || !cart.currency || cart.priceTypeId === null) {
      cart.setContext({ branchId, currency, priceTypeId })
    }
  }, [branchId, cart, currency, priceTypeId])

  const refreshPrices = async () => {
    const lines = useCartStore.getState().lines
    if (!lines.length) return
    const fresh = await salesApi.pos({
      branch: branchId,
      currency,
      price_type: priceTypeId,
      ids: lines.map((l) => l.product.id).join(','),
    })
    const changed = lines.some(
      (l) => fresh.find((p) => p.id === l.product.id)?.price !== l.product.price,
    )
    useCartStore.getState().refreshProducts(fresh)
    if (changed) toast.warning(t('pos.pricesUpdated'))
  }

  // sahifa qayta ochilganda savatdagi narx va qoldiqni yangilash
  const refreshed = useRef(false)
  useEffect(() => {
    if (refreshed.current || !currency || !cart.lines.length) return
    refreshed.current = true
    void refreshPrices()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat birinchi ochilishda
  }, [currency])

  // Kurs "1 birlik = N so'm" (CBU) formatida; ro'yxatda yo'q faol valyuta — kotirovka valyutasi (1)
  const rates = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    if (!latest.data) return map
    for (const c of currencies) {
      const row = latest.data.find((r) => r.code === c.code)
      map[c.code] = row ? (row.rate ?? undefined) : '1'
    }
    return map
  }, [latest.data, currencies])

  const totals = cartTotals(
    cart.lines.map((l) => ({
      quantity: l.quantity,
      price: l.product.price ?? '0',
      discount: l.discount,
    })),
    places,
  )
  const valid = cartIsValid(cart.lines, places) && totals.total >= 0n
  const activeMethods = (methods.data ?? []).filter((m) => m.is_active)

  const [checkout, setCheckout] = useState<{ key: string } | null>(null)
  const [paymentError, setPaymentError] = useState<ApiError | null>(null)
  const [success, setSuccess] = useState<SaleDetail | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [autoPrint, setAutoPrint] = useState(readAutoPrint)
  const [stockErrors, setStockErrors] = useState<{
    lines: CartLine[]
    byIndex: Record<number, string>
  }>({
    lines: [],
    byIndex: {},
  })

  const openCheckout = () => {
    if (!valid || checkout) return
    setPaymentError(null)
    setCheckout({ key: newIdempotencyKey() })
  }

  // F2 — qidiruv, F9 — to'lov
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (event.key === 'F9') {
        event.preventDefault()
        openCheckout()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const customerDetail = useCustomer(cart.customer?.id ?? null)
  const credit: CreditOptions | null = useMemo(() => {
    if (!canCredit || !cart.customer) return null
    const info = customerDetail.data?.credit
    const baseRate = info ? rates[info.base_currency] : undefined
    const available4 =
      info && baseRate && rates[currency]
        ? convertTo4(
            info.available_base,
            baseRate,
            rates[currency]!,
            info.base_currency === currency,
          )
        : null
    return { customerName: cart.customer.name, available4 }
  }, [canCredit, cart.customer, customerDetail.data, rates, currency])

  const pay = (payments: PaymentInput[], extra: { dueDate: string | null }) => {
    if (!checkout) return
    const lines = cart.lines
    createSale.mutate(
      {
        idempotencyKey: checkout.key,
        body: {
          branch: branchId,
          currency: currencies.find((c) => c.code === currency)!.id,
          price_type: priceTypeId,
          items: lines.map((l) => ({
            product: l.product.id,
            quantity: parseDecimalInput(l.quantity),
            discount_amount: parseDecimalInput(l.discount || '0'),
          })),
          payments,
          customer: cart.customer?.id ?? null,
          due_date: extra.dueDate,
          note: '',
          expected_total: minorToString(totals.total, places),
        },
      },
      {
        onSuccess: (sale) => {
          setCheckout(null)
          cart.clear()
          setSuccess(sale)
          if (autoPrint) void printReceipt(sale.id)
        },
        onError: (error) => {
          const apiError = toApiError(error)
          if (isApiError(error) && error.code === 'total_mismatch') {
            setCheckout(null)
            void refreshPrices()
            return
          }
          if (isApiError(error) && (error.code === 'insufficient_stock' || error.isValidation)) {
            const byIndex: Record<number, string> = {}
            for (const d of error.details) {
              const match = /^items\.(\d+)\./.exec(d.field ?? '')
              if (match) byIndex[Number(match[1])] = d.message
            }
            if (Object.keys(byIndex).length) {
              setCheckout(null)
              setStockErrors({ lines, byIndex })
              toast.error(error.message)
              return
            }
          }
          setPaymentError(apiError)
        },
      },
    )
  }

  const errorLines = stockErrors.lines === cart.lines ? stockErrors.byIndex : {}
  const money = (v: bigint) => formatNumber(minorToString(v, places), places)
  const locked = cart.lines.length > 0

  return (
    <div>
      <PageHeader title={t('pos.title')} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <ProductSearch
              context={{ branch: branchId, currency, price_type: priceTypeId }}
              places={places}
              inputRef={searchRef}
              onAdd={(product) => cart.add(product)}
            />
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {t('pos.cart')}
                {locked && (
                  <span className="ml-2 font-normal text-slate-500">
                    {t('pos.itemsCount', { count: cart.lines.length })}
                  </span>
                )}
              </h2>
            </div>
            <CartTable places={places} canDiscount={canDiscount} errorLines={errorLines} />
          </Card>
        </div>

        <aside className="space-y-4 self-start lg:sticky lg:top-4">
          <Card className="grid grid-cols-2 gap-3">
            <FormField
              label={t('pos.currency')}
              hint={locked ? t('pos.currencyLocked') : undefined}
            >
              <Select
                value={currency}
                disabled={locked}
                onChange={(e) =>
                  cart.setContext({ branchId, currency: e.target.value, priceTypeId })
                }
                data-testid="pos-currency"
              >
                {currencies.map((c) => (
                  <option key={c.id} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('pos.priceType')}>
              <Select
                value={priceTypeId ?? ''}
                disabled={locked}
                onChange={(e) =>
                  cart.setContext({ branchId, currency, priceTypeId: Number(e.target.value) })
                }
              >
                {priceTypes.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </Card>

          <Card className="space-y-2">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-sm font-medium text-slate-700">{t('pos.customer')}</p>
                <CustomerPicker
                  value={cart.customer}
                  onChange={cart.setCustomer}
                  placeholder={t('pos.customerPlaceholder')}
                />
              </div>
              {canCreateCustomer && (
                <Button
                  variant="secondary"
                  icon={<UserPlus className="size-4" />}
                  onClick={() => setNewCustomerOpen(true)}
                  aria-label={t('pos.newCustomer')}
                  data-testid="pos-new-customer"
                />
              )}
            </div>
            {cart.customer && customerDetail.data && (
              <div className="text-xs text-slate-500" data-testid="pos-customer-credit">
                {Number(customerDetail.data.debt_base) > 0 && (
                  <p className={customerDetail.data.has_overdue ? 'text-red-600' : ''}>
                    {t('pos.customerDebt', {
                      amount: formatNumber(
                        customerDetail.data.debt_base,
                        decimals[customerDetail.data.credit.base_currency] ?? 2,
                      ),
                      base: customerDetail.data.credit.base_currency,
                    })}
                  </p>
                )}
                {canCredit && (
                  <p>
                    {t('pos.creditAvailable', {
                      amount: formatNumber(
                        customerDetail.data.credit.available_base,
                        decimals[customerDetail.data.credit.base_currency] ?? 2,
                      ),
                      base: customerDetail.data.credit.base_currency,
                    })}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">{t('pos.subtotal')}</dt>
                <dd className="tabular-nums">{money(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0n && (
                <div className="flex justify-between text-amber-700">
                  <dt>{t('pos.discountTotal')}</dt>
                  <dd className="tabular-nums">−{money(totals.discount)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
                <dt className="text-base font-semibold">{t('pos.total')}</dt>
                <dd className="text-3xl font-bold tabular-nums" data-testid="pos-total">
                  {money(totals.total)} <span className="text-base font-semibold">{currency}</span>
                </dd>
              </div>
            </dl>
            {config.data?.max_discount_percent && canDiscount && (
              <p className="mt-1 text-xs text-slate-400">
                {t('pos.discount')}: ≤ {formatNumber(config.data.max_discount_percent, 0)}%
              </p>
            )}
            <Button
              className="mt-4 h-12 w-full text-base"
              icon={<CreditCard className="size-5" />}
              disabled={!valid || !activeMethods.length}
              onClick={openCheckout}
              data-testid="pos-pay"
            >
              {t('pos.pay')}
            </Button>
            <div className="mt-3 flex items-center justify-between">
              <Checkbox
                label={t('pos.autoPrint')}
                checked={autoPrint}
                onChange={(e) => {
                  setAutoPrint(e.target.checked)
                  try {
                    localStorage.setItem(AUTO_PRINT_KEY, e.target.checked ? '1' : '0')
                  } catch {
                    /* brauzer xotirasi yopiq — faqat shu seans */
                  }
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="size-4" />}
                disabled={!locked}
                onClick={() => setConfirmClear(true)}
              >
                {t('pos.clear')}
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {checkout && (
        <PaymentModal
          key={checkout.key}
          totalMinor={totals.total}
          saleCurrency={currency}
          places={places}
          currencies={currencies}
          decimals={decimals}
          rates={rates}
          methods={activeMethods}
          loading={createSale.isPending}
          error={paymentError}
          credit={credit}
          canCredit={canCredit}
          onClose={() => setCheckout(null)}
          onConfirm={pay}
        />
      )}
      {success && (
        <SaleSuccessModal
          sale={success}
          onClose={() => {
            setSuccess(null)
            setTimeout(() => searchRef.current?.focus(), 0)
          }}
        />
      )}
      <CustomerFormModal
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        onSaved={(c) => cart.setCustomer(c)}
      />
      <ConfirmDialog
        open={confirmClear}
        title={t('pos.clear')}
        text={t('pos.clearConfirm')}
        onConfirm={() => {
          cart.clear()
          setConfirmClear(false)
        }}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  )
}
