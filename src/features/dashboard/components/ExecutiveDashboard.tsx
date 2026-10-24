import { ArrowDownRight, ArrowUpRight, BarChart3, Table2 } from 'lucide-react'
import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useAuthStore } from '@/features/auth'
import { usePaymentMethods } from '@/features/payments'
import type { Dashboard, DashboardKpi } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { formatDate } from '@/shared/lib/date'
import { formatNumber } from '@/shared/lib/money'
import { Card, PageSpinner } from '@/shared/ui'

import { useDashboard, type DashboardPeriod } from '../api/dashboard.api'
import { colorFor, compact, INK, SERIES } from '../lib/chart'

const PERIODS: DashboardPeriod[] = ['today', '7d', '30d', 'month']

/** Rahbar dashboardi (dashboard.view). Filtr — bitta qator yuqorida; nuqta — sarlavhadagi tanlov. */
export default function ExecutiveDashboard() {
  const { t } = useTranslation('reports')
  const [period, setPeriod] = useState<DashboardPeriod>('today')
  const branchId = useAuthStore((s) => s.currentBranchId)
  const query = useDashboard({ period, branch: branchId ?? undefined })
  const data = query.data

  return (
    <div className="space-y-4" data-testid="executive-dashboard">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={cn(
                'px-3 py-1.5',
                period === p
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {t(`dashboard.periods.${p}`)}
            </button>
          ))}
        </div>
        {data && (
          <span className="text-xs text-slate-500">
            {formatDate(data.period.date_from)} — {formatDate(data.period.date_to)} ·{' '}
            {t('dashboard.live')}
          </span>
        )}
      </div>
      {!data ? (
        <PageSpinner />
      ) : (
        // qayta so'rashda oldingi holat xira — sakrash yo'q
        <div className={cn('space-y-4 transition-opacity', query.isFetching && 'opacity-70')}>
          <KpiRow data={data} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SalesTrend data={data} />
            </Card>
            <SideTiles data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <BranchBars data={data} />
            </Card>
            <Card>
              <PaymentMix data={data} />
            </Card>
            <Card>
              <TopProducts data={data} />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function money(value: string | number, base?: string) {
  return `${formatNumber(String(value), 2)}${base ? ` ${base}` : ''}`
}

// --- KPI ---

function KpiRow({ data }: { data: Dashboard }) {
  const { t } = useTranslation('reports')
  const base = data.base_currency
  const tiles: {
    key: string
    label: string
    kpi: DashboardKpi
    count?: boolean
    upIsBad?: boolean
  }[] = [
    { key: 'revenue', label: t('dashboard.revenue'), kpi: data.kpi.revenue },
    ...(data.kpi.profit
      ? [{ key: 'profit', label: t('dashboard.profit'), kpi: data.kpi.profit }]
      : []),
    {
      key: 'sales_count',
      label: t('dashboard.salesCount'),
      kpi: data.kpi.sales_count,
      count: true,
    },
    { key: 'average_check', label: t('dashboard.averageCheck'), kpi: data.kpi.average_check },
    { key: 'returns', label: t('dashboard.returns'), kpi: data.kpi.returns, upIsBad: true },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((tile) => (
        <StatTile
          key={tile.key}
          testId={`kpi-${tile.key}`}
          label={tile.label}
          value={tile.count ? formatNumber(tile.kpi.value, 0) : money(tile.kpi.value, base)}
          change={tile.kpi.change}
          upIsBad={tile.upIsBad}
        />
      ))}
    </div>
  )
}

function StatTile({
  label,
  value,
  change,
  upIsBad = false,
  testId,
}: {
  label: string
  value: string
  change: string | null
  upIsBad?: boolean
  testId: string
}) {
  const { t } = useTranslation('reports')
  const n = change === null ? null : Number(change)
  const good = n !== null && (upIsBad ? n < 0 : n > 0)
  const Icon = n !== null && n < 0 ? ArrowDownRight : ArrowUpRight
  return (
    <Card data-testid={testId}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900" data-testid={`${testId}-value`}>
        {value}
      </p>
      {n === null ? (
        <p className="mt-1 text-xs text-slate-400">{t('dashboard.noPrevious')}</p>
      ) : (
        <p className="mt-1 flex items-center gap-1 text-xs">
          <span
            className="inline-flex items-center gap-0.5 font-semibold"
            style={{ color: n === 0 ? INK.muted : good ? INK.up : INK.down }}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {n > 0 ? '+' : ''}
            {formatNumber(change!, 1)}%
          </span>
          <span className="text-slate-500">{t('dashboard.vsPrevious')}</span>
        </p>
      )}
    </Card>
  )
}

// --- savdo dinamikasi: chiziq (tushum — maydon bilan), bitta o'q ---

interface TrendPoint {
  label: string
  revenue: number
  profit?: number
  count: number
}

function SalesTrend({ data }: { data: Dashboard }) {
  const { t } = useTranslation('reports')
  const [asTable, setAsTable] = useState(false)
  const hourly = data.period.key === 'today'
  const points: TrendPoint[] = data.series.map((p) => ({
    label: hourly ? p.label : formatDate(p.label).slice(0, 5),
    revenue: Number(p.revenue),
    profit: p.profit === undefined ? undefined : Number(p.profit),
    count: p.count,
  }))
  const hasData = points.some((p) => p.revenue !== 0)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {t('dashboard.series', { base: data.base_currency })}
        </h2>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          aria-pressed={asTable}
        >
          {asTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
          {asTable ? t('dashboard.asChart') : t('dashboard.asTable')}
        </button>
      </div>
      {!hasData ? (
        <p className="py-16 text-center text-sm text-slate-500">{t('dashboard.noSales')}</p>
      ) : asTable ? (
        <div className="max-h-72 overflow-y-auto" data-testid="trend-table">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-1" />
                <th className="py-1 text-right">{t('dashboard.seriesRevenue')}</th>
                {data.show_profit && (
                  <th className="py-1 text-right">{t('dashboard.seriesProfit')}</th>
                )}
                <th className="py-1 text-right">{t('dashboard.salesCount')}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label} className="border-t border-slate-100 tabular-nums">
                  <td className="py-1">{p.label}</td>
                  <td className="py-1 text-right">{money(p.revenue)}</td>
                  {data.show_profit && <td className="py-1 text-right">{money(p.profit ?? 0)}</td>}
                  <td className="py-1 text-right">{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72" data-testid="sales-trend">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={INK.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: INK.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: INK.axis }}
                minTickGap={16}
              />
              <YAxis
                tick={{ fill: INK.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={compact}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: INK.axis, strokeWidth: 1 }}
                content={<TrendTooltip base={data.base_currency} />}
              />
              <Legend
                iconType="plainline"
                itemSorter={null}
                wrapperStyle={{ fontSize: 12, color: INK.secondary }}
                formatter={(value) => <span style={{ color: INK.secondary }}>{value}</span>}
              />
              <Area
                type="linear"
                dataKey="revenue"
                name={t('dashboard.seriesRevenue')}
                stroke={SERIES[0]}
                strokeWidth={2}
                fill={SERIES[0]}
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
              {data.show_profit && (
                <Line
                  type="linear"
                  dataKey="profit"
                  name={t('dashboard.seriesProfit')}
                  stroke={SERIES[1]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function TrendTooltip({
  active,
  payload,
  label,
  base,
}: {
  active?: boolean
  payload?: { payload: TrendPoint }[]
  label?: string
  base: string
}) {
  const { t } = useTranslation('reports')
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-slate-800">{label}</p>
      <TooltipRow
        color={SERIES[0]}
        label={t('dashboard.seriesRevenue')}
        value={money(p.revenue, base)}
      />
      {p.profit !== undefined && (
        <TooltipRow
          color={SERIES[1]}
          label={t('dashboard.seriesProfit')}
          value={money(p.profit, base)}
        />
      )}
      <p className="mt-1 text-slate-500">
        {t('dashboard.salesCount')}: {p.count}
      </p>
    </div>
  )
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <p className="flex items-center gap-2 text-slate-700">
      <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />
      <span>{label}</span>
      <span className="ml-auto pl-3 font-medium tabular-nums">{value}</span>
    </p>
  )
}

// --- nuqtalar: gorizontal ustunlar (bitta seriya — bitta rang, legend yo'q) ---

function BranchBars({ data }: { data: Dashboard }) {
  const { t } = useTranslation('reports')
  const rows = foldBranches(data.by_branch, t)
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        {t('dashboard.byBranch', { base: data.base_currency })}
      </h2>
      {!rows.length ? (
        <p className="py-10 text-center text-sm text-slate-500">{t('dashboard.noSales')}</p>
      ) : (
        <div style={{ height: Math.max(rows.length * 36 + 16, 96) }} data-testid="branch-bars">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="branch"
                width={120}
                tick={{ fill: INK.secondary, fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: INK.axis }}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                formatter={(value) => [
                  money(Number(value), data.base_currency),
                  t('dashboard.seriesRevenue'),
                ]}
              />
              <Bar
                dataKey="value"
                fill={SERIES[0]}
                barSize={18}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  formatter={(value: unknown) => compact(Number(value))}
                  style={{ fill: INK.secondary, fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const MAX_BRANCH_BARS = 8

/** Ko'p nuqta bo'lsa — eng kattalari va qolganlari bitta «Boshqa» ustunida (yangi rang yo'q). */
function foldBranches(rows: Dashboard['by_branch'], t: TFunction<'reports'>) {
  const items = rows.map((b) => ({ branch: b.branch, value: Number(b.revenue) }))
  if (items.length <= MAX_BRANCH_BARS) return items
  const head = items.slice(0, MAX_BRANCH_BARS - 1)
  const rest = items.slice(MAX_BRANCH_BARS - 1)
  return [
    ...head,
    {
      branch: t('dashboard.otherBranches', { count: rest.length }),
      value: rest.reduce((acc, b) => acc + b.value, 0),
    },
  ]
}

// --- to'lov turlari: qism-butun — bitta gorizontal yig'ma ustun + qiymatli legend ---

function PaymentMix({ data }: { data: Dashboard }) {
  const { t } = useTranslation('reports')
  const methods = usePaymentMethods()
  const [hover, setHover] = useState<string | null>(null)
  // rang to'lov turining doimiy tartibidan (davr o'zgarsa ham o'zgarmaydi)
  const order = (methods.data ?? []).map((m) => m.name)
  const rows = data.payment_methods.filter((m) => Number(m.amount) > 0)
  const total = rows.reduce((acc, m) => acc + Number(m.amount), 0)
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">
        {t('dashboard.paymentMethods', { base: data.base_currency })}
      </h2>
      {!rows.length ? (
        <p className="py-10 text-center text-sm text-slate-500">{t('dashboard.noSales')}</p>
      ) : (
        <>
          <div className="flex h-5 gap-[2px] overflow-hidden rounded" data-testid="payment-mix">
            {rows.map((m) => (
              <div
                key={m.method}
                className="h-full transition-opacity"
                style={{
                  width: `${(Number(m.amount) / total) * 100}%`,
                  background: colorFor(m.method, order),
                  opacity: hover && hover !== m.method ? 0.4 : 1,
                }}
                onMouseEnter={() => setHover(m.method)}
                onMouseLeave={() => setHover(null)}
                title={`${m.method}: ${money(m.amount, data.base_currency)}`}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {rows.map((m) => (
              <li
                key={m.method}
                className="flex items-center gap-2"
                onMouseEnter={() => setHover(m.method)}
                onMouseLeave={() => setHover(null)}
              >
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: colorFor(m.method, order) }}
                />
                <span className="text-slate-700">{m.method}</span>
                <span className="ml-auto font-medium text-slate-900 tabular-nums">
                  {money(m.amount)}
                </span>
                <span className="w-12 text-right text-xs text-slate-500 tabular-nums">
                  {formatNumber((Number(m.amount) / total) * 100, 0)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// --- top tovarlar: jadval + ingichka ulush chizig'i (bitta rang) ---

function TopProducts({ data }: { data: Dashboard }) {
  const { t } = useTranslation('reports')
  const max = Math.max(...data.top_products.map((p) => Number(p.revenue)), 0)
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('dashboard.topProducts')}</h2>
      {!data.top_products.length ? (
        <p className="py-10 text-center text-sm text-slate-500">{t('dashboard.noSales')}</p>
      ) : (
        <table className="w-full text-sm" data-testid="top-products">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="pb-1">{t('dashboard.product')}</th>
              <th className="pb-1 text-right">{t('dashboard.quantity')}</th>
              <th className="pb-1 text-right">
                {t('dashboard.amount', { base: data.base_currency })}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.top_products.map((p) => (
              <tr key={p.product_id} className="border-t border-slate-100 align-top">
                <td className="py-1.5 pr-2">
                  <Link to={`/inventory/products/${p.product_id}`} className="hover:underline">
                    {p.name}
                  </Link>
                  <div className="mt-1 h-1 rounded-full bg-slate-100">
                    <div
                      className="h-1 rounded-full"
                      style={{
                        width: `${max ? (Number(p.revenue) / max) * 100 : 0}%`,
                        background: SERIES[0],
                      }}
                    />
                  </div>
                </td>
                <td className="py-1.5 text-right whitespace-nowrap text-slate-600 tabular-nums">
                  {formatNumber(p.quantity, 3).replace(/,?0+$/, '')} {p.unit}
                </td>
                <td className="py-1.5 pl-2 text-right font-medium tabular-nums">
                  {money(p.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// --- yon plitkalar: kassa, qarzlar, ombor ---

function SideTiles({ data }: { data: Dashboard }) {
  const { t } = useTranslation('reports')
  const base = data.base_currency
  return (
    <div className="grid gap-3">
      <Card>
        <p className="text-xs font-medium text-slate-500">{t('dashboard.cash')}</p>
        <ul className="mt-1 space-y-0.5" data-testid="dashboard-cash">
          {data.cash.length === 0 && <li className="text-sm text-slate-400">—</li>}
          {data.cash.map((c) => (
            <li key={c.currency} className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">{c.currency}</span>
              <span className="text-lg font-semibold text-slate-900">
                {formatNumber(c.balance, c.decimal_places)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <p className="text-xs font-medium text-slate-500">{t('dashboard.debts', { base })}</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {t('dashboard.debtsOpen')}: {money(data.debts.open)}
        </p>
        {data.debts.overdue_count > 0 ? (
          <Link
            to="/debts"
            className="text-sm font-medium hover:underline"
            style={{ color: INK.down }}
          >
            {t('dashboard.debtsOverdue', { count: data.debts.overdue_count })} ·{' '}
            {money(data.debts.overdue)}
          </Link>
        ) : (
          <p className="text-sm text-slate-500">{t('dashboard.debtsOverdue', { count: 0 })}</p>
        )}
      </Card>
      <Card>
        <p className="text-xs font-medium text-slate-500">{t('dashboard.inventory')}</p>
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-y-0.5 text-sm">
          <dt className="text-slate-600">{t('dashboard.lowStock')}</dt>
          <dd className="text-right font-semibold">
            <Link to="/inventory/stock?below=1" className="hover:underline">
              {data.inventory.low_stock}
            </Link>
          </dd>
          {data.inventory.stock_value !== null && (
            <>
              <dt className="text-slate-600">{t('dashboard.stockValue', { base })}</dt>
              <dd className="text-right font-semibold">{money(data.inventory.stock_value)}</dd>
            </>
          )}
          <dt className="text-slate-600">{t('dashboard.incoming')}</dt>
          <dd className="text-right font-semibold">{data.inventory.incoming_transfers}</dd>
        </dl>
      </Card>
    </div>
  )
}
