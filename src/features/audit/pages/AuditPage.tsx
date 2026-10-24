import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AuditLog } from '@/shared/api/types'
import { useListParams } from '@/shared/hooks/useListParams'
import { formatDateTime } from '@/shared/lib/date'
import { Badge, Button, FormField, Input, PageHeader, Pagination } from '@/shared/ui'

import { useAuditLogs } from '../api/audit.api'

export function AuditPage() {
  const { t } = useTranslation('audit')
  const { t: tc } = useTranslation()
  const { params, page, set, setPage } = useListParams()
  const logs = useAuditLogs({
    page,
    event_prefix: params.event_prefix,
    date_from: params.date_from,
    date_to: params.date_to,
  })
  const [openId, setOpenId] = useState<number | null>(null)

  const eventLabel = (name: string) => t(`events.${name}`, { defaultValue: name })

  return (
    <div>
      <PageHeader title={t('title')} />
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <FormField label={t('filters.eventPrefix')} className="w-full sm:w-64">
          <Input
            value={params.event_prefix ?? ''}
            onChange={(e) => set({ event_prefix: e.target.value })}
            placeholder={t('filters.eventPrefixPlaceholder')}
          />
        </FormField>
        <FormField label={t('filters.dateFrom')}>
          <Input
            type="date"
            value={params.date_from ?? ''}
            onChange={(e) => set({ date_from: e.target.value })}
          />
        </FormField>
        <FormField label={t('filters.dateTo')}>
          <Input
            type="date"
            value={params.date_to ?? ''}
            onChange={(e) => set({ date_to: e.target.value })}
          />
        </FormField>
        <Button
          variant="ghost"
          onClick={() => set({ event_prefix: null, date_from: null, date_to: null })}
          className="h-10"
        >
          {tc('actions.reset')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className="px-4 py-2.5">{t('when')}</th>
              <th className="px-4 py-2.5">{t('event')}</th>
              <th className="px-4 py-2.5">{t('actor')}</th>
              <th className="px-4 py-2.5">{t('branch')}</th>
              <th className="px-4 py-2.5">{t('object')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.data?.results.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  {tc('status.empty')}
                </td>
              </tr>
            )}
            {logs.data?.results.map((log: AuditLog) => {
              const open = openId === log.id
              return (
                <Fragment key={log.id}>
                  <tr
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setOpenId(open ? null : log.id)}
                  >
                    <td className="px-2 py-2 text-slate-400">
                      {open ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{eventLabel(log.event_name)}</div>
                      <code className="text-xs text-slate-400">{log.event_name}</code>
                    </td>
                    <td className="px-4 py-2">
                      {log.actor_full_name ?? log.actor_username ?? (
                        <Badge tone="neutral">{t('system')}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{log.branch_name ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {log.aggregate_type
                        ? log.aggregate_id != null
                          ? `${log.aggregate_type} #${log.aggregate_id}`
                          : log.aggregate_type
                        : '—'}
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-slate-50">
                      <td />
                      <td colSpan={5} className="px-4 py-3">
                        <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">
                          {t('payload')}
                        </p>
                        <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                        <p className="mt-2 text-xs text-slate-400">
                          IP: {log.ip || '—'} · request: {log.request_id || '—'}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Pagination
          page={page}
          totalPages={logs.data?.total_pages ?? 1}
          count={logs.data?.count ?? 0}
          onChange={setPage}
        />
      </div>
    </div>
  )
}
