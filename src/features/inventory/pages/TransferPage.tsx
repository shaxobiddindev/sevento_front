import { AlertTriangle, ArrowLeft, Ban, PackageCheck, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { useAuthStore, useCapability } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import { isApiError } from '@/shared/api/errors'
import type { TransferDetail, TransferWriteRequest } from '@/shared/api/types'
import { formatDateTime } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import {
  Button,
  Card,
  ConfirmDialog,
  FormField,
  PageHeader,
  PageSpinner,
  Select,
  Textarea,
  toast,
} from '@/shared/ui'

import {
  useCancelTransfer,
  useSaveTransfer,
  useSendTransfer,
  useTransfer,
  useTransferDestinations,
} from '../api/documents.api'
import { TransferStatusBadge } from '../components/DocStatusBadge'
import { LinesEditor } from '../components/LinesEditor'
import { ReasonModal } from '../components/ReasonModal'
import { ReceiveTransferModal } from '../components/ReceiveTransferModal'
import { useLineValidation } from '../hooks/useLineValidation'
import {
  formatQty,
  newLine,
  splitLineErrors,
  toLineRequests,
  type LineErrors,
  type LineValue,
} from '../lib/lines'

/** /new → /:id ga o'tganda holat qayta yaratiladi. */
export function TransferPage() {
  const { id } = useParams()
  const transfer = useTransfer(id)
  if (id !== undefined && transfer.isPending) return <PageSpinner />
  const data = transfer.data
  if (!data || (data.status === 'draft' && data.allowed.edit)) {
    return <TransferEditor key={data?.id ?? 'new'} transfer={data} />
  }
  return <TransferView transfer={data} />
}

function TransferEditor({ transfer }: { transfer?: TransferDetail }) {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const currentBranchId = useAuthStore((s) => s.currentBranchId)
  const canCreate = useCapability('inventory.transfers.create')
  const destinations = useTransferDestinations(canCreate)
  const save = useSaveTransfer()
  const send = useSendTransfer()
  const cancel = useCancelTransfer()
  const checkLines = useLineValidation()

  const [fromBranch, setFromBranch] = useState(
    String(transfer?.from_branch ?? currentBranchId ?? user?.branches[0]?.id ?? ''),
  )
  const [toBranch, setToBranch] = useState(transfer ? String(transfer.to_branch) : '')
  const [note, setNote] = useState(transfer?.note ?? '')
  const [lines, setLines] = useState<LineValue[]>(
    transfer
      ? transfer.items.map((i) =>
          newLine(
            {
              id: i.product,
              name: i.product_name,
              sku: i.product_sku,
              unit_code: i.unit_code,
              unit_decimal_places: i.unit_decimal_places,
            },
            formatQty(i.quantity, i.unit_decimal_places),
          ),
        )
      : [newLine()],
  )
  const [lineErrors, setLineErrors] = useState<LineErrors>({})
  const [toError, setToError] = useState<string>()
  const [dirty, setDirty] = useState(!transfer)
  const [confirmSend, setConfirmSend] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const touch =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v)
      setDirty(true)
    }

  const validate = (): boolean => {
    const problems = checkLines(lines)
    setLineErrors(problems)
    const toMissing = !toBranch
    setToError(toMissing ? tc('validation:required') : undefined)
    return Object.keys(problems).length === 0 && !toMissing
  }

  const showServerError = (error: unknown) => {
    if (!isApiError(error) || !error.details.length) {
      toast.error(error instanceof Error ? error.message : String(error))
      return
    }
    const { lines: byLine, rest } = splitLineErrors(error.details)
    setLineErrors(byLine)
    const toDetail = rest.find((d) => d.field === 'to_branch')
    if (toDetail) setToError(toDetail.message)
    const others = rest.filter((d) => d.field !== 'to_branch')
    if (others.length || (!Object.keys(byLine).length && !toDetail)) toast.error(error.message)
  }

  const body = (): TransferWriteRequest => ({
    from_branch: Number(fromBranch),
    to_branch: Number(toBranch),
    note,
    items: toLineRequests(lines),
  })

  const persist = async (): Promise<TransferDetail | null> => {
    if (!validate()) return null
    try {
      const saved = await save.mutateAsync({ id: transfer?.id, body: body() })
      setDirty(false)
      return saved
    } catch (error) {
      showServerError(error)
      return null
    }
  }

  const onSave = async () => {
    const saved = await persist()
    if (!saved) return
    toast.success(transfer ? t('transfers.saved') : t('transfers.created'))
    if (!transfer) navigate(`/inventory/transfers/${saved.id}`, { replace: true })
  }

  const onSend = async () => {
    const saved = dirty ? await persist() : transfer
    if (!saved) {
      setConfirmSend(false)
      return
    }
    try {
      await send.mutateAsync(saved.id)
      toast.success(t('transfers.sentToast'))
      setConfirmSend(false)
      if (!transfer) navigate(`/inventory/transfers/${saved.id}`, { replace: true })
    } catch (error) {
      setConfirmSend(false)
      if (!transfer) navigate(`/inventory/transfers/${saved.id}`, { replace: true })
      showServerError(error)
    }
  }

  const destinationOptions = (destinations.data ?? []).filter((b) => String(b.id) !== fromBranch)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={transfer ? transfer.number : t('transfers.new')}
        actions={
          <>
            {transfer && <TransferStatusBadge status={transfer.status} />}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/inventory/transfers')}
            >
              {t('doc.back')}
            </Button>
          </>
        }
      />
      <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
        {t('transfers.draftHidden')}
      </p>
      <div className="space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t('transfers.from')} required>
              <Select
                value={fromBranch}
                onChange={(e) => touch(setFromBranch)(e.target.value)}
                disabled={!!transfer}
                data-testid="transfer-from"
              >
                {user?.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('transfers.to')} required error={toError}>
              <Select
                value={toBranch}
                onChange={(e) => {
                  touch(setToBranch)(e.target.value)
                  setToError(undefined)
                }}
                invalid={!!toError}
                data-testid="transfer-to"
              >
                <option value="">—</option>
                {destinationOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('doc.note')}>
              <Textarea rows={1} value={note} onChange={(e) => touch(setNote)(e.target.value)} />
            </FormField>
          </div>
        </Card>
        <Card>
          <LinesEditor
            value={lines}
            onChange={(next) => {
              touch(setLines)(next)
              setLineErrors({})
            }}
            errors={lineErrors}
            editable
          />
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          {transfer?.allowed.cancel && (
            <Button
              variant="secondary"
              icon={<Ban className="size-4" />}
              onClick={() => setCancelOpen(true)}
            >
              {t('doc.cancel')}
            </Button>
          )}
          <Button variant="secondary" loading={save.isPending && !confirmSend} onClick={onSave}>
            {t('doc.save')}
          </Button>
          <Button
            icon={<Send className="size-4" />}
            onClick={() => validate() && setConfirmSend(true)}
            data-testid="transfer-send"
          >
            {dirty ? t('transfers.saveAndSend') : t('transfers.send')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSend}
        title={t('transfers.send')}
        text={t('transfers.sendConfirm')}
        confirmLabel={t('transfers.send')}
        danger={false}
        loading={save.isPending || send.isPending}
        onConfirm={() => void onSend()}
        onClose={() => setConfirmSend(false)}
      />
      {transfer && (
        <ReasonModal
          open={cancelOpen}
          title={t('doc.cancel')}
          loading={cancel.isPending}
          onClose={() => setCancelOpen(false)}
          onConfirm={(reason) =>
            cancel.mutate(
              { id: transfer.id, reason },
              {
                onSuccess: () => {
                  toast.success(t('transfers.cancelled'))
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

function TransferView({ transfer }: { transfer: TransferDetail }) {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const { base, decimals } = useActiveCurrencies()
  const cancel = useCancelTransfer()
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const showCost = transfer.total_cost_base !== undefined
  const baseDp = decimals[base] ?? 2
  const received = transfer.status === 'received'

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={transfer.number}
        subtitle={t('transfers.route', {
          from: transfer.from_branch_name,
          to: transfer.to_branch_name,
        })}
        actions={
          <>
            <span data-testid="transfer-detail-status">
              <TransferStatusBadge status={transfer.status} />
            </span>
            {transfer.allowed.receive && (
              <Button
                icon={<PackageCheck className="size-4" />}
                onClick={() => setReceiveOpen(true)}
                data-testid="transfer-receive"
              >
                {t('transfers.receive')}
              </Button>
            )}
            {transfer.allowed.cancel && (
              <Button
                variant="secondary"
                icon={<Ban className="size-4" />}
                onClick={() => setCancelOpen(true)}
              >
                {t('doc.cancel')}
              </Button>
            )}
            <Button
              variant="ghost"
              icon={<ArrowLeft className="size-4" />}
              onClick={() => navigate('/inventory/transfers')}
            >
              {t('doc.back')}
            </Button>
          </>
        }
      />

      {transfer.has_discrepancy && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{t('transfers.discrepancy')}</p>
            {transfer.shortage_write_off && (
              <p>
                {t('transfers.shortageWriteOff')}:{' '}
                <Link
                  to={`/inventory/write-offs/${transfer.shortage_write_off.id}`}
                  className="underline"
                >
                  {transfer.shortage_write_off.number}
                </Link>
                {showCost && transfer.shortage_cost_base !== undefined && (
                  <>
                    {' · '}
                    {t('transfers.shortageCost', { base })}:{' '}
                    {formatMoney(transfer.shortage_cost_base, base, baseDp)}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="pb-2">{t('doc.product')}</th>
              <th className="pb-2 text-right">{t('transfers.sentQty')}</th>
              {received && <th className="pb-2 text-right">{t('transfers.receivedQty')}</th>}
              {received && <th className="pb-2 text-right">{t('transfers.shortage')}</th>}
              {showCost && <th className="pb-2 text-right">{t('doc.totalCost', { base })}</th>}
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item) => {
              const short = Number(item.shortage) > 0
              return (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="py-2">
                    {item.product_name}
                    <span className="ml-1 text-xs text-slate-500">{item.product_sku}</span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatQty(item.quantity, item.unit_decimal_places)} {item.unit_code}
                  </td>
                  {received && (
                    <td className="py-2 text-right tabular-nums">
                      {formatQty(item.quantity_received, item.unit_decimal_places)}
                    </td>
                  )}
                  {received && (
                    <td
                      className={`py-2 text-right tabular-nums ${short ? 'font-semibold text-red-700' : 'text-slate-400'}`}
                    >
                      {short ? formatQty(item.shortage, item.unit_decimal_places) : '—'}
                    </td>
                  )}
                  {showCost && (
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(item.total_cost_base ?? '0', base, baseDp)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
          {showCost && transfer.total_cost_base !== undefined && (
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold">
                <td colSpan={received ? 4 : 2} className="pt-2 text-right" />
                <td className="pt-2 text-right tabular-nums">
                  {formatMoney(transfer.total_cost_base, base, baseDp)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>

      <Card className="space-y-1 text-xs text-slate-600">
        {transfer.note && <p className="text-sm text-slate-800">{transfer.note}</p>}
        <p>
          {t('doc.createdBy')}: {transfer.created_by_name ?? '—'} ·{' '}
          {formatDateTime(transfer.created_at)}
        </p>
        {transfer.sent_at && (
          <p>
            {t('transfers.sentBy')}: {transfer.sent_by_name ?? '—'} ·{' '}
            {formatDateTime(transfer.sent_at)}
          </p>
        )}
        {transfer.received_at && (
          <p>
            {t('transfers.receivedBy')}: {transfer.received_by_name ?? '—'} ·{' '}
            {formatDateTime(transfer.received_at)}
            {transfer.receive_note && ` — ${transfer.receive_note}`}
          </p>
        )}
        {transfer.cancelled_at && (
          <p>
            {t('transfers.cancelledBy')}: {transfer.cancelled_by_name ?? '—'} ·{' '}
            {formatDateTime(transfer.cancelled_at)} — {transfer.cancel_reason}
          </p>
        )}
      </Card>

      {receiveOpen && (
        <ReceiveTransferModal transfer={transfer} onClose={() => setReceiveOpen(false)} />
      )}
      <ReasonModal
        open={cancelOpen}
        title={t('doc.cancel')}
        hint={transfer.status === 'sent' ? t('transfers.cancelSentHint') : undefined}
        loading={cancel.isPending}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) =>
          cancel.mutate(
            { id: transfer.id, reason },
            {
              onSuccess: () => {
                toast.success(t('transfers.cancelled'))
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
    </div>
  )
}
