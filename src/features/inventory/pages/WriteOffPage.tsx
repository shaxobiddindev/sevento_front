import { ArrowLeft, Ban, PackageX } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { useAuthStore } from '@/features/auth'
import { useActiveCurrencies } from '@/features/currency'
import { isApiError } from '@/shared/api/errors'
import type { WriteOffDetail } from '@/shared/api/types'
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
  useCancelWriteOff,
  useCreateWriteOff,
  useWriteOff,
  useWriteOffReasons,
} from '../api/documents.api'
import { WriteOffStatusBadge } from '../components/DocStatusBadge'
import { LinesEditor } from '../components/LinesEditor'
import { ReasonModal } from '../components/ReasonModal'
import { useLineValidation } from '../hooks/useLineValidation'
import { formatQty, newLine, splitLineErrors, toLineRequests, type LineErrors } from '../lib/lines'

export function WriteOffPage() {
  const { id } = useParams()
  const writeOff = useWriteOff(id)
  if (id === undefined) return <WriteOffForm />
  if (writeOff.isPending) return <PageSpinner />
  return writeOff.data ? <WriteOffView writeOff={writeOff.data} /> : null
}

/** Yaratilishi bilan yakunlanadi (FIFO chiqim) — qoralama yo'q. */
function WriteOffForm() {
  const { t } = useTranslation('inventory')
  const { t: tc } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const currentBranchId = useAuthStore((s) => s.currentBranchId)
  const reasons = useWriteOffReasons()
  const create = useCreateWriteOff()
  const [branch, setBranch] = useState(String(currentBranchId ?? user?.branches[0]?.id ?? ''))
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState([newLine()])
  const [lineErrors, setLineErrors] = useState<LineErrors>({})
  const [reasonError, setReasonError] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const checkLines = useLineValidation()
  const manualReasons = (reasons.data ?? []).filter((r) => !r.is_system && r.is_active !== false)

  const validate = () => {
    const problems = checkLines(lines)
    setLineErrors(problems)
    setReasonError(reason ? undefined : tc('validation:required'))
    return Object.keys(problems).length === 0 && !!reason
  }

  const onCreate = () =>
    create.mutate(
      { branch: Number(branch), reason: Number(reason), note, items: toLineRequests(lines) },
      {
        onSuccess: (data) => {
          toast.success(t('writeOffs.created'))
          navigate(`/inventory/write-offs/${data.id}`, { replace: true })
        },
        onError: (error) => {
          setConfirm(false)
          if (isApiError(error) && error.details.length) {
            const { lines: byLine } = splitLineErrors(error.details)
            setLineErrors(byLine)
          }
          toast.error(error.message)
        },
      },
    )

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={t('writeOffs.new')}
        actions={
          <Button
            variant="ghost"
            icon={<ArrowLeft className="size-4" />}
            onClick={() => navigate('/inventory/write-offs')}
          >
            {t('doc.back')}
          </Button>
        }
      />
      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label={t('writeOffs.branch')} required>
            <Select value={branch} onChange={(e) => setBranch(e.target.value)}>
              {user?.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('writeOffs.reason')} required error={reasonError}>
            <Select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError(undefined)
              }}
              invalid={!!reasonError}
              data-testid="write-off-reason"
            >
              <option value="">—</option>
              {manualReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t('doc.note')}>
            <Textarea rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
        </div>
      </Card>
      <Card>
        <LinesEditor
          value={lines}
          onChange={(next) => {
            setLines(next)
            setLineErrors({})
          }}
          errors={lineErrors}
          editable
        />
      </Card>
      <div className="flex justify-end">
        <Button
          variant="danger"
          icon={<PackageX className="size-4" />}
          onClick={() => validate() && setConfirm(true)}
          data-testid="write-off-submit"
        >
          {t('writeOffs.create')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title={t('writeOffs.create')}
        text={t('writeOffs.createConfirm')}
        confirmLabel={t('writeOffs.create')}
        loading={create.isPending}
        onConfirm={onCreate}
        onClose={() => setConfirm(false)}
      />
    </div>
  )
}

function WriteOffView({ writeOff }: { writeOff: WriteOffDetail }) {
  const { t } = useTranslation('inventory')
  const navigate = useNavigate()
  const { base, decimals } = useActiveCurrencies()
  const cancel = useCancelWriteOff()
  const [cancelOpen, setCancelOpen] = useState(false)
  const showCost = writeOff.total_cost_base !== undefined
  const baseDp = decimals[base] ?? 2

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={writeOff.number}
        subtitle={`${writeOff.branch_name} · ${writeOff.reason_name}`}
        actions={
          <>
            <WriteOffStatusBadge status={writeOff.status} />
            {writeOff.can_cancel && (
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
              onClick={() => navigate('/inventory/write-offs')}
            >
              {t('doc.back')}
            </Button>
          </>
        }
      />
      {writeOff.transfer && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Link to={`/inventory/transfers/${writeOff.transfer}`} className="underline">
            {t('writeOffs.fromTransfer', { number: writeOff.transfer_number })}
          </Link>{' '}
          — {t('writeOffs.systemNoCancel')}
        </p>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="pb-2">{t('doc.product')}</th>
              <th className="pb-2 text-right">{t('doc.quantity')}</th>
              {showCost && <th className="pb-2 text-right">{t('doc.unitCost', { base })}</th>}
              {showCost && <th className="pb-2 text-right">{t('doc.totalCost', { base })}</th>}
            </tr>
          </thead>
          <tbody>
            {writeOff.items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-2">
                  {item.product_name}
                  <span className="ml-1 text-xs text-slate-500">{item.product_sku}</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatQty(item.quantity, item.unit_decimal_places)} {item.unit_code}
                </td>
                {showCost && (
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(item.unit_cost_base ?? '0', base, 4)}
                  </td>
                )}
                {showCost && (
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(item.total_cost_base ?? '0', base, baseDp)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {showCost && (
            <tfoot>
              <tr className="border-t border-slate-200 font-semibold">
                <td colSpan={3} />
                <td className="pt-2 text-right tabular-nums" data-testid="write-off-total">
                  {formatMoney(writeOff.total_cost_base ?? '0', base, baseDp)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
      <Card className="space-y-1 text-xs text-slate-600">
        {writeOff.note && <p className="text-sm text-slate-800">{writeOff.note}</p>}
        <p>
          {t('doc.createdBy')}: {writeOff.created_by_name ?? '—'} ·{' '}
          {formatDateTime(writeOff.completed_at)}
        </p>
        {writeOff.cancelled_at && (
          <p>
            {t('transfers.cancelledBy')}: {writeOff.cancelled_by_name ?? '—'} ·{' '}
            {formatDateTime(writeOff.cancelled_at)} — {writeOff.cancel_reason}
          </p>
        )}
      </Card>
      <ReasonModal
        open={cancelOpen}
        title={t('doc.cancel')}
        hint={t('writeOffs.cancelHint')}
        loading={cancel.isPending}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) =>
          cancel.mutate(
            { id: writeOff.id, reason },
            {
              onSuccess: () => {
                toast.success(t('writeOffs.cancelled'))
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
